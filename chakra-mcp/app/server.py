"""The MCP server and its tool."""

import json
from typing import Annotated, Literal

import httpx
from mcp.server.mcpserver import MCPServer
from pydantic import Field

from .chakra_client import fetch_tasks, shape_task
from .config import settings

mcp = MCPServer(
    "chakra",
    instructions=(
        "Read-only access to the Chakra task system. Chakra sorts work into "
        "buckets (Karya = act now, Dhairya = wait, Manan = reflect, Manthan = "
        "churn on it, Vishram = rest, Prarabdha = accept, Tyaga = let go) and "
        "weights each task W1 (lightest) to W5 (heaviest). Use get_chakra_tasks "
        "to pull the current list before planning a day or a week."
    ),
)

# Values observed in the live data. Passed through as filters rather than
# validated, so a newly introduced bucket or horizon keeps working.
BUCKETS = "Karya, Dhairya, Manan, Manthan, Vishram, Prarabdha, Tyaga"
HORIZONS = "today, thisWeek, nextWeek, thisMonth, thisYear, Q3"


@mcp.tool(
    name="get_chakra_tasks",
    title="Get Chakra tasks",
    description=(
        "Returns tasks from the Chakra app. Filter by completion status, bucket, "
        "planning horizon, weight, or life area. Note that many tasks have no "
        "horizon or weight set - filtering on those fields excludes them."
    ),
)
async def get_chakra_tasks(
    status: Annotated[
        Literal["pending", "done", "all"],
        Field(description="Completion status. Defaults to pending (active tasks)."),
    ] = "pending",
    bucket: Annotated[
        str | None,
        Field(description=f"Chakra bucket. One of: {BUCKETS}."),
    ] = None,
    time_horizon: Annotated[
        str | None,
        Field(description=f"Planning horizon. Typically one of: {HORIZONS}."),
    ] = None,
    weightage: Annotated[
        str | None,
        Field(description="Task weight, W1 (lightest) through W5 (heaviest)."),
    ] = None,
    life_area: Annotated[
        str | None,
        Field(description="Life area, e.g. Personal/Family, Work/Employment, Picturizze."),
    ] = None,
    limit: Annotated[
        int,
        Field(ge=1, le=500, description="Maximum tasks to return. Defaults to 100."),
    ] = 100,
) -> str:
    """Fetch and filter the task list, newest and most-aged first."""
    try:
        rows = await fetch_tasks()
    except httpx.HTTPStatusError as exc:
        return (
            f"Chakra API returned {exc.response.status_code}. "
            "If this is 401, SECRET_KEY here does not match the Chakra backend."
        )
    except httpx.RequestError as exc:
        return f"Could not reach the Chakra API at {settings.CHAKRA_API_URL}: {exc}"

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

    # Most-aged first, then most recently entered - the order DK triages in.
    rows.sort(
        key=lambda r: (r.get("aging_days") or 0, r.get("entry_timestamp") or ""),
        reverse=True,
    )

    total = len(rows)
    tasks = [shape_task(r) for r in rows[:limit]]

    if not tasks:
        return "No tasks match those filters."

    payload: dict = {"count": total, "tasks": tasks}
    if total > limit:
        payload["note"] = f"Showing the first {limit} of {total} matching tasks."
    return json.dumps(payload, indent=2, default=str)
