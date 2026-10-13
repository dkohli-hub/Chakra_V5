"""Talks to the existing Chakra FastAPI backend.

We deliberately go through the app's own REST API rather than querying Postgres
directly. That reuses the user scoping the backend already enforces and means there
is no second copy of the schema to drift out of sync.

Reads use GET /tasks. Writes use POST /tasks (add) and PATCH /tasks/{id} (update),
sending only the fields that change - the same way the Chakra web app saves. There is
deliberately no delete here: a task can be completed or moved to Tyaga, never removed.

New tasks and changes follow the web app's own rules (DK's Chakra prototype):
dates and "this week" use America/Chicago, a bucket move is added to state_history,
and completing a task that carries a follow-up creates that follow-up task.
"""

import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Any
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

import httpx
from jose import jwt

from .config import settings

BUCKETS = ["Karya", "Dhairya", "Vishram", "Manan", "Manthan", "Tyaga", "Prarabdha"]
HORIZONS = ["today", "thisWeek", "nextWeek", "thisMonth", "Q3", "Q4", "thisYear", "1year", "2years", "parkingLot"]
WEIGHTS = {"W1": "5 min", "W2": "30 min", "W3": "1 hr", "W4": "half day", "W5": "full day", "W6": "30 days"}
W_MIN = {"W1": 5, "W2": 30, "W3": 60, "W4": 240, "W5": 480, "W6": 480}
LIFE_AREAS = ["Personal/Family", "Work/Employment", "Picturizze", "Other"]
# The app's three top categories, stored the same way the web app stores them.
CATEGORY_OF_AREA = {"Picturizze": "Picturizze", "Work/Employment": "Employment", "Personal/Family": "Personal"}


class ChakraError(Exception):
    """A problem worth showing to the user as plain text."""


def _mint_token() -> str:
    """Mint a short-lived Chakra JWT for CHAKRA_USER_ID.

    Mirrors backend/app/routers/auth.py create_token(). Five-minute expiry, minted
    per request, so there is no long-lived credential sitting in the environment.
    """
    return jwt.encode(
        {
            "sub": settings.CHAKRA_USER_ID,
            "name": settings.CHAKRA_DISPLAY_NAME,
            "exp": datetime.now(timezone.utc) + timedelta(minutes=5),
        },
        settings.SECRET_KEY,
        algorithm="HS256",
    )


async def _request(method: str, path: str, body: dict | None = None) -> Any:
    url = f"{settings.CHAKRA_API_URL.rstrip('/')}{path}"
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.request(
            method, url, json=body, headers={"Authorization": f"Bearer {_mint_token()}"}
        )
        resp.raise_for_status()
        return resp.json()


async def fetch_tasks() -> list[dict[str, Any]]:
    """GET /tasks as CHAKRA_USER_ID. The backend filters by the token's subject."""
    return await _request("GET", "/tasks")


async def find_task(task_id: str) -> dict[str, Any]:
    for t in await fetch_tasks():
        if t.get("id") == task_id:
            return t
    raise ChakraError(f"No task with id {task_id}. Use get_chakra_tasks to find the id.")


# --- time, the app's way -------------------------------------------------------

def _tz():
    try:
        return ZoneInfo(settings.TIMEZONE)
    except ZoneInfoNotFoundError:
        return timezone.utc


def now_local() -> datetime:
    return datetime.now(_tz())


def now_iso() -> str:
    """UTC timestamp in the same shape the web app writes (toISOString)."""
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def _local_time(value: Any) -> str | None:
    """Render a timestamp in the configured timezone.

    entry_timestamp is timestamptz in the Chakra schema, so a single conversion is
    correct - converting through UTC first would double-shift it.
    """
    if not value:
        return None
    if isinstance(value, str):
        try:
            value = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return value
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(_tz()).strftime("%Y-%m-%d %H:%M %Z")


def days_sitting(raw: dict[str, Any]) -> int:
    """Days since the task was entered (America/Chicago), as the app counts it since V21."""
    v = raw.get("entry_timestamp")
    if not v:
        return 0
    try:
        e = datetime.fromisoformat(str(v).replace("Z", "+00:00"))
    except ValueError:
        return 0
    if e.tzinfo is None:
        e = e.replace(tzinfo=timezone.utc)
    return max(0, (now_local().date() - e.astimezone(_tz()).date()).days)


def parse_date(value: str) -> date:
    try:
        return date.fromisoformat(value)
    except (TypeError, ValueError):
        raise ChakraError(f"Date must be YYYY-MM-DD, got {value!r}.")


def parse_time(value: str) -> str:
    try:
        h, m = value.split(":")[:2]
        h, m = int(h), int(m)
        assert 0 <= h <= 23 and 0 <= m <= 59
        return f"{h:02d}:{m:02d}"
    except Exception:
        raise ChakraError(f"Time must be HH:MM in 24-hour form, got {value!r}.")


def horizon_from_date(d: date) -> str:
    """Same rule as the app's horizonFromDate(): this week ends Saturday."""
    today = now_local().date()
    diff = (d - today).days
    if diff <= 0:
        return "today"
    to_sat = (5 - today.weekday()) % 7          # Mon=0 … Sat=5, Sun=6 → coming Saturday
    if diff <= to_sat:
        return "thisWeek"
    if diff <= to_sat + 7:
        return "nextWeek"
    if diff <= 30:
        return "thisMonth"
    if d.year == today.year:
        if 6 <= d.month - 1 <= 8:
            return "Q3"
        if d.month - 1 >= 9:
            return "Q4"
        return "thisYear"
    return "1year" if d.year - today.year == 1 else "2years"


def apply_area(body: dict, life_area: str) -> None:
    if life_area not in LIFE_AREAS:
        raise ChakraError(f"life_area must be one of {', '.join(LIFE_AREAS)}.")
    body["life_area"] = life_area
    body["needs_area"] = False
    if life_area in CATEGORY_OF_AREA:
        body["category"] = CATEGORY_OF_AREA[life_area]


def short_title_of(title: str) -> str:
    t = title.strip()
    return t if len(t) <= 60 else t[:57].rsplit(" ", 1)[0] + "…"


def clean_contacts(contacts: list[dict] | None) -> list[dict]:
    out = []
    for c in contacts or []:
        if not isinstance(c, dict):
            continue
        row = {
            "name": c.get("name") or None,
            "org": c.get("org") or None,
            "title": c.get("title") or None,
            "phones": [str(p) for p in (c.get("phones") or []) if str(p).strip()],
            "emails": [str(e) for e in (c.get("emails") or []) if "@" in str(e)],
            "website": c.get("website") or None,
            "address": c.get("address") or None,
            "saved": False,
        }
        if c.get("cc"):
            row["cc"] = str(c["cc"])
        if row["name"] or row["org"] or row["phones"] or row["emails"]:
            out.append(row)
    return out


def new_task_id() -> str:
    return f"task_{int(datetime.now(timezone.utc).timestamp() * 1000)}_{uuid.uuid4().hex[:4]}"


# --- writes --------------------------------------------------------------------

async def create_task(body: dict[str, Any]) -> dict[str, Any]:
    return await _request("POST", "/tasks", body)


async def update_task(task_id: str, changes: dict[str, Any]) -> dict[str, Any]:
    return await _request("PATCH", f"/tasks/{task_id}", changes)


def follow_up_body(src: dict[str, Any], text: str, gap_days: int | None) -> dict[str, Any]:
    """The app's makeFollowUp(): W2, due `gap_days` from today, linked back to the source."""
    now = now_iso()
    due = now_local().date() + timedelta(days=max(1, gap_days or 1))
    title = text.strip()[:1].upper() + text.strip()[1:]
    return {
        "id": new_task_id(), "title": title, "short_title": short_title_of(title),
        "bucket": "Karya", "origin_bucket": "Karya", "ch": 3, "weightage": "W2", "duration_min": W_MIN["W2"],
        "time_horizon": horizon_from_date(due), "due_date": due.isoformat(), "due_time": None,
        "due_date_at": now, "deadline_set_at": now, "no_date_given": False,
        "life_area": src.get("life_area"), "category": src.get("category"), "multitask": False,
        "state_history": [{"bucket": "Karya", "timestamp": now}], "completed": False,
        "entry_timestamp": now, "aging_days": 0,
        "follows_id": src.get("id"), "linked_tasks": [src.get("id")],
    }


# --- shaping for Claude -------------------------------------------------------

def shape_task(raw: dict[str, Any]) -> dict[str, Any]:
    """Every field DK's app keeps, in plain names; empty values left out."""
    w = raw.get("weightage")
    shaped = {
        "id": raw.get("id"),
        "title": raw.get("title"),
        "short_title": raw.get("short_title") if raw.get("short_title") != raw.get("title") else None,
        "bucket": raw.get("bucket"),
        "weightage": f"{w} ({WEIGHTS[w]})" if w in WEIGHTS else w,
        "time_horizon": raw.get("time_horizon"),
        "due_date": raw.get("due_date"),
        "due_time": raw.get("due_time"),
        "duration_min": raw.get("duration_min"),
        "life_area": raw.get("life_area"),
        "category": raw.get("category"),
        "chapter": raw.get("ch"),
        "multitask": raw.get("multitask"),
        "completed": raw.get("completed"),
        "details": raw.get("details") or None,
        "contacts": raw.get("contacts") or None,
        "country_code": raw.get("cc"),
        "follow_up_text": raw.get("follow_up_text") if not raw.get("follow_up_spawned_id") else None,
        "follow_up_gap_days": raw.get("follow_up_gap") if raw.get("follow_up_text") and not raw.get("follow_up_spawned_id") else None,
        "follows_task": raw.get("follows_id"),
        "linked_tasks": raw.get("linked_tasks") or None,
        "depends_on": raw.get("depends_on"),
        "no_date_given": True if raw.get("no_date_given") else None,
        "needs_category": True if raw.get("needs_area") else None,
        "days_sitting": days_sitting(raw),
        "entry_time": _local_time(raw.get("entry_timestamp")),
    }
    # Only surface movement history when the task has actually moved buckets.
    if raw.get("origin_bucket") and raw.get("origin_bucket") != raw.get("bucket"):
        shaped["moved_from"] = raw.get("origin_bucket")
        shaped["times_moved"] = raw.get("transition_count")
    if raw.get("completed") and raw.get("completed_timestamp"):
        shaped["completed_time"] = _local_time(raw.get("completed_timestamp"))
    return {k: v for k, v in shaped.items() if v is not None}
