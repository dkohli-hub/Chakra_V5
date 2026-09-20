"""Talks to the existing Chakra FastAPI backend.

We deliberately go through the app's own REST API rather than querying Postgres
directly. That keeps this service read-only by construction, reuses the user
scoping the backend already enforces, and means there is no second copy of the
schema to drift out of sync.
"""

from datetime import datetime, timedelta, timezone
from typing import Any
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

import httpx
from jose import jwt

from .config import settings


def _mint_read_token() -> str:
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


async def fetch_tasks() -> list[dict[str, Any]]:
    """GET /tasks as CHAKRA_USER_ID. The backend filters by the token's subject."""
    url = f"{settings.CHAKRA_API_URL.rstrip('/')}/tasks"
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.get(
            url, headers={"Authorization": f"Bearer {_mint_read_token()}"}
        )
        resp.raise_for_status()
        return resp.json()


def _local_time(value: Any) -> str | None:
    """Render a timestamp in the configured timezone.

    entry_timestamp is timestamptz in the Chakra schema, so a single conversion is
    correct — converting through UTC first would double-shift it.
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
    try:
        value = value.astimezone(ZoneInfo(settings.TIMEZONE))
    except ZoneInfoNotFoundError:
        # A missing tz database must not take the whole tool down; fall back to UTC.
        value = value.astimezone(timezone.utc)
    return value.strftime("%Y-%m-%d %H:%M %Z")


def shape_task(raw: dict[str, Any]) -> dict[str, Any]:
    """Trim a task row to the fields worth spending context on."""
    shaped = {
        "id": raw.get("id"),
        "title": raw.get("title"),
        "bucket": raw.get("bucket"),
        "weightage": raw.get("weightage"),
        "time_horizon": raw.get("time_horizon"),
        "life_area": raw.get("life_area"),
        "chapter": raw.get("ch"),
        "multitask": raw.get("multitask"),
        "completed": raw.get("completed"),
        "aging_days": raw.get("aging_days"),
        "entry_time": _local_time(raw.get("entry_timestamp")),
    }
    # Only surface movement history when the task has actually moved buckets —
    # otherwise it is noise on every row.
    if raw.get("origin_bucket") and raw.get("origin_bucket") != raw.get("bucket"):
        shaped["moved_from"] = raw.get("origin_bucket")
        shaped["times_moved"] = raw.get("transition_count")
    if raw.get("completed") and raw.get("completed_timestamp"):
        shaped["completed_time"] = _local_time(raw.get("completed_timestamp"))
    return {k: v for k, v in shaped.items() if v is not None}
