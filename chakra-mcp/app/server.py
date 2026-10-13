"""The MCP server and its tools: read, add and update Chakra tasks (no delete)."""

import json
from typing import Annotated, Any, Literal

import httpx
from mcp.server.mcpserver import MCPServer
from mcp.types import ToolAnnotations
from pydantic import Field

from .chakra_client import (
    BUCKETS,
    HORIZONS,
    W_MIN,
    WEIGHTS,
    ChakraError,
    apply_area,
    clean_contacts,
    create_task,
    days_sitting,
    fetch_tasks,
    find_task,
    follow_up_body,
    horizon_from_date,
    new_task_id,
    now_iso,
    now_local,
    parse_date,
    parse_time,
    shape_task,
    short_title_of,
    update_task,
)
from .config import settings

mcp = MCPServer(
    "chakra",
    instructions=(
        "Read, add and update tasks in DK's Chakra app. Tasks can never be deleted here: "
        "finish one with completed=true, or let it go by moving it to the Tyaga bucket. "
        "Buckets: Karya = act now, Dhairya = waiting on someone, Vishram = leisure, no deadline, "
        "Manan = think first, Manthan = two pulls to resolve, Tyaga = let go, Prarabdha = already "
        "in motion. Weights: W1 5 min, W2 30 min, W3 1 hr, W4 half day, W5 full day, W6 30 days. "
        "Life areas: Personal/Family, Work/Employment (DK's ITC job), Picturizze (his photography "
        "business), Other. Dates are America/Chicago; 'this week' ends Saturday. "
        "Always call get_chakra_tasks first to find a task's id before updating it, and confirm "
        "with DK before completing, moving or rewriting a task he did not name."
    ),
)


def _http_error(exc: Exception) -> str:
    if isinstance(exc, httpx.HTTPStatusError):
        return (
            f"Chakra API returned {exc.response.status_code}. "
            "If this is 401, SECRET_KEY here does not match the Chakra backend."
        )
    return f"Could not reach the Chakra API at {settings.CHAKRA_API_URL}: {exc}"


def _dump(payload: Any) -> str:
    return json.dumps(payload, indent=2, default=str, ensure_ascii=False)


# --- read ------------------------------------------------------------------------

@mcp.tool(
    name="get_chakra_tasks",
    title="Get Chakra tasks",
    description=(
        "Returns tasks from the Chakra app with every field the app keeps: due date and time, "
        "details and notes, contacts (phones, emails), follow-ups, links, bucket, weight, life "
        "area. Filter by status, bucket, horizon, weight, life area, or search text."
    ),
    annotations=ToolAnnotations(read_only_hint=True),
)
async def get_chakra_tasks(
    status: Annotated[
        Literal["pending", "done", "all"],
        Field(description="Completion status. Defaults to pending (active tasks)."),
    ] = "pending",
    bucket: Annotated[
        str | None,
        Field(description=f"Chakra bucket. One of: {', '.join(BUCKETS)}."),
    ] = None,
    time_horizon: Annotated[
        str | None,
        Field(description=f"Planning horizon. One of: {', '.join(HORIZONS)}."),
    ] = None,
    weightage: Annotated[
        str | None,
        Field(description="Task weight: " + ", ".join(f"{k} = {v}" for k, v in WEIGHTS.items()) + "."),
    ] = None,
    life_area: Annotated[
        str | None,
        Field(description="Life area: Personal/Family, Work/Employment, Picturizze or Other."),
    ] = None,
    search: Annotated[
        str | None,
        Field(description="Words to look for in the title, details, contacts and follow-up text."),
    ] = None,
    limit: Annotated[
        int,
        Field(ge=1, le=500, description="Maximum tasks to return. Defaults to 100."),
    ] = 100,
) -> str:
    """Fetch and filter the task list: dated tasks soonest first, then the rest by days sitting."""
    try:
        rows = await fetch_tasks()
    except (httpx.HTTPStatusError, httpx.RequestError) as exc:
        return _http_error(exc)

    if status != "all":
        want_done = status == "done"
        rows = [r for r in rows if bool(r.get("completed")) is want_done]

    def matches(row: dict, field: str, wanted: str | None) -> bool:
        if not wanted:
            return True
        value = row.get(field)
        return value is not None and str(value).lower() == wanted.lower()

    rows = [
        r
        for r in rows
        if matches(r, "bucket", bucket)
        and matches(r, "time_horizon", time_horizon)
        and matches(r, "weightage", weightage)
        and matches(r, "life_area", life_area)
    ]

    if search:
        words = [w for w in search.lower().split() if w]

        def hay(r: dict) -> str:
            parts = [r.get("title"), r.get("short_title"), r.get("details"), r.get("follow_up_text"), r.get("category")]
            for c in r.get("contacts") or []:
                if isinstance(c, dict):
                    parts += [c.get("name"), c.get("org"), c.get("title"), " ".join(c.get("phones") or []), " ".join(c.get("emails") or [])]
            return " ".join(str(p) for p in parts if p).lower()

        rows = [r for r in rows if all(w in hay(r) for w in words)]

    # Tasks with a due date first (soonest first), then the rest by days sitting (oldest first).
    rows.sort(key=lambda r: (
        0 if r.get("due_date") else 1,
        r.get("due_date") or "",
        -days_sitting(r),
    ))

    total = len(rows)
    tasks = [shape_task(r) for r in rows[:limit]]

    if not tasks:
        return "No tasks match those filters."

    payload: dict = {"count": total, "today": now_local().strftime("%A %Y-%m-%d"), "tasks": tasks}
    if total > limit:
        payload["note"] = f"Showing the first {limit} of {total} matching tasks."
    return _dump(payload)


# --- add -------------------------------------------------------------------------

@mcp.tool(
    name="add_chakra_task",
    title="Add a Chakra task",
    description=(
        "Adds one task to DK's Chakra app, exactly as the app itself would save it. Give a clear "
        "self-explanatory title; put anything else (prices, addresses, background) in details. "
        "Pass due_date (YYYY-MM-DD) when there is a deadline; leave it out and set bucket=Vishram "
        "for leisure tasks with no deadline. Contacts become Call / WhatsApp / Save buttons in the app."
    ),
    annotations=ToolAnnotations(read_only_hint=False, destructive_hint=False, idempotent_hint=False),
)
async def add_chakra_task(
    title: Annotated[str, Field(min_length=1, max_length=300, description="What has to be done.")],
    details: Annotated[str | None, Field(description="Notes kept with the task.")] = None,
    due_date: Annotated[str | None, Field(description="Deadline date, YYYY-MM-DD, today or later.")] = None,
    due_time: Annotated[str | None, Field(description="Deadline time, HH:MM 24-hour. Needs due_date.")] = None,
    time_horizon: Annotated[
        str | None,
        Field(description=f"Use only when there is no exact date. One of: {', '.join(HORIZONS)}."),
    ] = None,
    weightage: Annotated[
        str | None,
        Field(description="How long it takes: " + ", ".join(f"{k} = {v}" for k, v in WEIGHTS.items()) + ". Default W2."),
    ] = None,
    bucket: Annotated[str | None, Field(description=f"One of: {', '.join(BUCKETS)}. Default Karya.")] = None,
    life_area: Annotated[
        str | None,
        Field(description="Personal/Family, Work/Employment, Picturizze or Other."),
    ] = None,
    multitask: Annotated[
        bool | None,
        Field(description="True only if DK can do it while walking, driving, eating or on a call."),
    ] = None,
    chapter: Annotated[int | None, Field(ge=1, le=18, description="Gita chapter / arena 1-18. Default 3.")] = None,
    contacts: Annotated[
        list[dict] | None,
        Field(description='People for this task: [{"name","org","phones":[...],"emails":[...],"cc":"+1"}].'),
    ] = None,
    follow_up_text: Annotated[
        str | None,
        Field(description="Next step to create automatically when this task is completed."),
    ] = None,
    follow_up_gap_days: Annotated[
        int | None,
        Field(ge=1, le=365, description="Days after completion that the follow-up is due. Default 1."),
    ] = None,
) -> str:
    try:
        b = bucket or "Karya"
        if b not in BUCKETS:
            raise ChakraError(f"bucket must be one of {', '.join(BUCKETS)}.")
        w = weightage or "W2"
        if w not in WEIGHTS:
            raise ChakraError(f"weightage must be one of {', '.join(WEIGHTS)}.")
        if time_horizon and time_horizon not in HORIZONS:
            raise ChakraError(f"time_horizon must be one of {', '.join(HORIZONS)}.")
        if due_time and not due_date:
            raise ChakraError("due_time needs a due_date.")

        now = now_iso()
        clean = title.strip()
        body: dict[str, Any] = {
            "id": new_task_id(), "title": clean, "short_title": short_title_of(clean),
            "bucket": b, "origin_bucket": b, "ch": chapter or 3, "weightage": w,
            "multitask": multitask is True, "depends_on": None,
            "state_history": [{"bucket": b, "timestamp": now}],
            "completed": False, "entry_timestamp": now, "aging_days": 0,
        }
        if weightage:
            body["duration_min"] = W_MIN[w]
        if due_date:
            d = parse_date(due_date)
            if d < now_local().date():
                raise ChakraError(f"{due_date} has passed. Pick today or a later date.")
            body.update(
                due_date=d.isoformat(), due_time=parse_time(due_time) if due_time else None,
                time_horizon=horizon_from_date(d), due_date_at=now, deadline_set_at=now, no_date_given=False,
            )
        elif time_horizon:
            body["time_horizon"] = time_horizon
        elif b != "Vishram":
            # The app's rule: no date and not leisure → due this Saturday, tagged "no date given".
            body.update(time_horizon="thisWeek", no_date_given=True)
        if life_area:
            apply_area(body, life_area)
        if details and details.strip():
            body["details"] = details.strip()
        cl = clean_contacts(contacts)
        if cl:
            body["contacts"] = cl
        if follow_up_text and follow_up_text.strip():
            body["follow_up_text"] = follow_up_text.strip()
            body["follow_up_gap"] = follow_up_gap_days or 1
        try:
            body["num"] = len(await fetch_tasks()) + 1
        except Exception:
            pass
        saved = await create_task(body)
    except ChakraError as exc:
        return f"Not added: {exc}"
    except (httpx.HTTPStatusError, httpx.RequestError) as exc:
        return _http_error(exc)
    return _dump({"added": shape_task(saved)})


# --- update ----------------------------------------------------------------------

@mcp.tool(
    name="update_chakra_task",
    title="Update a Chakra task",
    description=(
        "Changes one existing task: title, details, date and time, weight, bucket, life area, "
        "multitask, contacts or follow-up, or marks it completed / reopened. Only the fields you "
        "pass are changed. Completing a task that holds a follow-up creates that follow-up task. "
        "There is no delete: to drop a task, move it to the Tyaga bucket."
    ),
    annotations=ToolAnnotations(read_only_hint=False, destructive_hint=False, idempotent_hint=False),
)
async def update_chakra_task(
    task_id: Annotated[str, Field(description="The task id from get_chakra_tasks.")],
    title: Annotated[str | None, Field(max_length=300, description="New title.")] = None,
    details: Annotated[str | None, Field(description="Replace the details with this text.")] = None,
    append_details: Annotated[str | None, Field(description="Add this text below the existing details.")] = None,
    due_date: Annotated[str | None, Field(description="New deadline date, YYYY-MM-DD.")] = None,
    due_time: Annotated[str | None, Field(description="New deadline time, HH:MM 24-hour.")] = None,
    clear_due_date: Annotated[bool, Field(description="Remove the exact date (keeps the horizon).")] = False,
    time_horizon: Annotated[str | None, Field(description=f"New horizon. One of: {', '.join(HORIZONS)}.")] = None,
    weightage: Annotated[str | None, Field(description=f"New weight: {', '.join(WEIGHTS)}.")] = None,
    bucket: Annotated[str | None, Field(description=f"Move to bucket: {', '.join(BUCKETS)}.")] = None,
    life_area: Annotated[str | None, Field(description="Personal/Family, Work/Employment, Picturizze or Other.")] = None,
    multitask: Annotated[bool | None, Field(description="Can it be done while multitasking.")] = None,
    completed: Annotated[bool | None, Field(description="True to complete the task, False to reopen it.")] = None,
    add_contacts: Annotated[
        list[dict] | None,
        Field(description='Contacts to add: [{"name","org","phones":[...],"emails":[...],"cc":"+1"}].'),
    ] = None,
    follow_up_text: Annotated[str | None, Field(description="Next step to create when the task is completed.")] = None,
    follow_up_gap_days: Annotated[int | None, Field(ge=1, le=365, description="Days after completion it is due.")] = None,
) -> str:
    try:
        cur = await find_task(task_id)
        ch: dict[str, Any] = {}
        now = now_iso()
        history = list(cur.get("state_history") or [])
        moves = int(cur.get("transition_count") or 0)
        notes: list[str] = []

        if title is not None and title.strip() and title.strip() != cur.get("title"):
            ch["title"] = title.strip()
            ch["short_title"] = short_title_of(title)
        if details is not None:
            ch["details"] = details.strip()
        if append_details and append_details.strip():
            base = ch.get("details", cur.get("details") or "")
            ch["details"] = (base + "\n\n" if base else "") + append_details.strip()
        if weightage is not None:
            if weightage not in WEIGHTS:
                raise ChakraError(f"weightage must be one of {', '.join(WEIGHTS)}.")
            ch["weightage"] = weightage
        if life_area is not None:
            apply_area(ch, life_area)
        if multitask is not None:
            ch["multitask"] = multitask
        if add_contacts:
            new = clean_contacts(add_contacts)
            if new:
                ch["contacts"] = list(cur.get("contacts") or []) + new
        if follow_up_text is not None:
            ch["follow_up_text"] = follow_up_text.strip() or None
            ch["follow_up_gap"] = (follow_up_gap_days or 1) if follow_up_text.strip() else None
        elif follow_up_gap_days is not None:
            ch["follow_up_gap"] = follow_up_gap_days

        # Dates: an exact date wins; a new horizon alone clears the exact date (the app's rule).
        if due_date:
            d = parse_date(due_date)
            if d < now_local().date():
                raise ChakraError(f"{due_date} has passed. Pick today or a later date.")
            ch.update(
                due_date=d.isoformat(), time_horizon=horizon_from_date(d),
                due_time=parse_time(due_time) if due_time else None,
                due_date_at=now, deadline_set_at=now, no_date_given=False,
            )
        elif due_time:
            if not cur.get("due_date"):
                raise ChakraError("due_time needs a due_date. Pass due_date too.")
            ch.update(due_time=parse_time(due_time), due_date_at=now, deadline_set_at=now)
        elif clear_due_date:
            ch.update(due_date=None, due_time=None, deadline_set_at=now, no_date_given=False)
        if time_horizon is not None and not due_date:
            if time_horizon not in HORIZONS:
                raise ChakraError(f"time_horizon must be one of {', '.join(HORIZONS)}.")
            ch.update(time_horizon=time_horizon, due_date=None, due_time=None, deadline_set_at=now, no_date_given=False)

        if bucket is not None and bucket != cur.get("bucket"):
            if bucket not in BUCKETS:
                raise ChakraError(f"bucket must be one of {', '.join(BUCKETS)}.")
            history.append({"bucket": bucket, "timestamp": now})
            moves += 1
            ch["bucket"] = bucket

        follow_body = None
        if completed is True and not cur.get("completed"):
            history.append({"bucket": "Completed", "timestamp": now})
            moves += 1
            ch.update(completed=True, completed_timestamp=now)
            fu_text = ch.get("follow_up_text", cur.get("follow_up_text"))
            if fu_text and not cur.get("follow_up_spawned_id"):
                follow_body = follow_up_body({**cur, **ch}, fu_text, ch.get("follow_up_gap", cur.get("follow_up_gap")))
                ch["follow_up_spawned_id"] = follow_body["id"]
        elif completed is False and cur.get("completed"):
            ch["completed"] = False
            if cur.get("follow_up_spawned_id") and cur.get("follow_up_spawned_id") != "route2":
                notes.append(
                    "A follow-up task was created when this was completed; it is still there. "
                    "Complete it or move it to Tyaga if it is no longer needed."
                )

        if len(history) != len(cur.get("state_history") or []):
            ch["state_history"] = history
            ch["transition_count"] = moves

        if not ch:
            return "Nothing to change: the task already has those values."

        result: dict[str, Any] = {}
        if follow_body:
            follow_body["num"] = len(await fetch_tasks()) + 1
            result["follow_up_created"] = shape_task(await create_task(follow_body))
        result["updated"] = shape_task(await update_task(task_id, ch))
        result["changed_fields"] = sorted(ch)
        if notes:
            result["note"] = " ".join(notes)
    except ChakraError as exc:
        return f"Not changed: {exc}"
    except (httpx.HTTPStatusError, httpx.RequestError) as exc:
        return _http_error(exc)
    return _dump(result)
