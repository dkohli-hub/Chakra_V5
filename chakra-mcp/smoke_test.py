"""End-to-end smoke test: OAuth flow, auth gate, MCP handshake, tool call.

Runs the real app against a stub Chakra API seeded from the production backup,
so the tool path is exercised without touching the live database.

    .venv/Scripts/python.exe smoke_test.py
"""

import asyncio
import base64
import hashlib
import json
import os
import secrets
import sys
import threading
from pathlib import Path
from urllib.parse import parse_qs, urlparse

BACKUP = Path(__file__).parent.parent / "chakra-full-backup-2026-10-14_0021.json"

# Configure before app import so Settings picks these up.
os.environ.update(
    CHAKRA_API_URL="http://127.0.0.1:8899",
    SECRET_KEY="test-secret-key-for-smoke-test",
    CHAKRA_USER_ID="dk",
    MCP_ACCESS_TOKEN="static-token-abc123",
    MCP_LOGIN_PASSWORD="hunter2",
    MCP_SECRET="test-mcp-signing-secret",
    PUBLIC_URL="",
)

import httpx  # noqa: E402
import uvicorn  # noqa: E402
from jose import jwt  # noqa: E402
from starlette.applications import Starlette  # noqa: E402
from starlette.responses import JSONResponse  # noqa: E402
from starlette.routing import Route  # noqa: E402

from app.main import app as mcp_app  # noqa: E402

PASSES: list[str] = []
FAILS: list[str] = []


def check(label: str, ok: bool, detail: str = "") -> None:
    (PASSES if ok else FAILS).append(label)
    print(f"  {'PASS' if ok else 'FAIL'}  {label}{(' - ' + detail) if detail and not ok else ''}")


# --- Stub Chakra backend ---------------------------------------------------

def load_tasks() -> list[dict]:
    raw = json.loads(BACKUP.read_text(encoding="utf-8"))
    out = []
    for i, t in enumerate(raw):
        row = dict(t)
        row["id"] = f"task_{i:04d}"
        row["user_id"] = "dk"
        row["num"] = i
        row["transition_count"] = 0
        row["aging_days"] = i % 40
        row.setdefault("state_history", [])
        out.append(row)
    return out


TASKS = load_tasks()


async def stub_tasks(request):
    auth = request.headers.get("authorization", "")
    if not auth.startswith("Bearer "):
        return JSONResponse({"detail": "Not authenticated"}, status_code=401)
    try:
        claims = jwt.decode(auth[7:], os.environ["SECRET_KEY"], algorithms=["HS256"])
    except Exception:
        return JSONResponse({"detail": "Invalid token"}, status_code=401)
    return JSONResponse([t for t in TASKS if t["user_id"] == claims["sub"]])


WRITES: list[tuple[str, str, dict]] = []


def _claims(request):
    auth = request.headers.get("authorization", "")
    try:
        return jwt.decode(auth[7:], os.environ["SECRET_KEY"], algorithms=["HS256"])
    except Exception:
        return None


async def stub_create(request):
    if not _claims(request):
        return JSONResponse({"detail": "Invalid token"}, status_code=401)
    body = await request.json()
    WRITES.append(("POST", body.get("id"), body))
    row = {"transition_count": 0, "linked_tasks": [], "contacts": [], **body, "user_id": "dk"}
    TASKS.append(row)
    return JSONResponse(row)


async def stub_patch(request):
    if not _claims(request):
        return JSONResponse({"detail": "Invalid token"}, status_code=401)
    tid = request.path_params["tid"]
    body = await request.json()
    WRITES.append(("PATCH", tid, body))
    for row in TASKS:
        if row["id"] == tid:
            row.update(body)
            return JSONResponse(row)
    return JSONResponse({"detail": "Task not found"}, status_code=404)


async def stub_delete(request):
    WRITES.append(("DELETE", request.path_params.get("tid", ""), {}))
    return JSONResponse({"ok": True})


stub = Starlette(routes=[
    Route("/tasks", stub_tasks, methods=["GET"]),
    Route("/tasks", stub_create, methods=["POST"]),
    Route("/tasks/{tid}", stub_patch, methods=["PATCH"]),
    Route("/tasks/{tid}", stub_delete, methods=["DELETE"]),
])


def serve(application, port: int) -> uvicorn.Server:
    cfg = uvicorn.Config(application, host="127.0.0.1", port=port, log_level="error")
    server = uvicorn.Server(cfg)
    threading.Thread(target=server.run, daemon=True).start()
    return server


async def wait_ready(url: str, tries: int = 60) -> bool:
    async with httpx.AsyncClient() as c:
        for _ in range(tries):
            try:
                await c.get(url, timeout=1.0)
                return True
            except Exception:
                await asyncio.sleep(0.25)
    return False


# --- MCP helpers -----------------------------------------------------------

MCP_HEADERS = {
    "Content-Type": "application/json",
    "Accept": "application/json, text/event-stream",
    "MCP-Protocol-Version": "2025-06-18",
}


def parse_mcp(resp: httpx.Response) -> dict:
    """Streamable HTTP replies as SSE; pull the JSON out of the data: line."""
    text = resp.text
    if text.lstrip().startswith("{"):
        return resp.json()
    for line in text.splitlines():
        if line.startswith("data:"):
            return json.loads(line[5:].strip())
    raise AssertionError(f"No JSON-RPC payload in response: {text[:300]}")


async def mcp_call(client: httpx.AsyncClient, token: str, payload: dict) -> dict:
    resp = await client.post(
        "http://127.0.0.1:8898/mcp",
        json=payload,
        headers={**MCP_HEADERS, "Authorization": f"Bearer {token}"},
    )
    resp.raise_for_status()
    return parse_mcp(resp)


async def initialize(client: httpx.AsyncClient, token: str) -> dict:
    return await mcp_call(
        client,
        token,
        {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
            "params": {
                "protocolVersion": "2025-06-18",
                "capabilities": {},
                "clientInfo": {"name": "smoke-test", "version": "1.0"},
            },
        },
    )


# --- The test --------------------------------------------------------------

async def main() -> int:
    serve(stub, 8899)
    serve(mcp_app, 8898)
    if not await wait_ready("http://127.0.0.1:8899/tasks"):
        print("stub API never came up")
        return 1
    if not await wait_ready("http://127.0.0.1:8898/health"):
        print("mcp app never came up")
        return 1

    async with httpx.AsyncClient(timeout=20.0) as c:
        print("\n[1] Auth gate")
        r = await c.get("http://127.0.0.1:8898/health")
        check("health is public", r.status_code == 200, r.text[:120])

        r = await c.post("http://127.0.0.1:8898/mcp", json={}, headers=MCP_HEADERS)
        check("unauthenticated /mcp is rejected", r.status_code == 401, str(r.status_code))
        check(
            "401 carries resource_metadata challenge",
            "resource_metadata" in r.headers.get("www-authenticate", ""),
            r.headers.get("www-authenticate", "<none>"),
        )
        r = await c.post(
            "http://127.0.0.1:8898/mcp",
            json={},
            headers={**MCP_HEADERS, "Authorization": "Bearer wrong-token"},
        )
        check("wrong token is rejected", r.status_code == 401, str(r.status_code))

        print("\n[2] OAuth discovery")
        r = await c.get("http://127.0.0.1:8898/.well-known/oauth-protected-resource")
        check("protected-resource metadata", r.status_code == 200 and "authorization_servers" in r.text)
        r = await c.get("http://127.0.0.1:8898/.well-known/oauth-authorization-server")
        meta = r.json() if r.status_code == 200 else {}
        check("authorization-server metadata", r.status_code == 200 and "token_endpoint" in meta)
        check("advertises PKCE S256", meta.get("code_challenge_methods_supported") == ["S256"])

        print("\n[3] OAuth flow")
        r = await c.post(
            "http://127.0.0.1:8898/oauth/register",
            json={"client_name": "Claude", "redirect_uris": ["https://claude.ai/api/mcp/auth_callback"]},
        )
        check("dynamic client registration", r.status_code == 201 and "client_id" in r.text)
        client_id = r.json().get("client_id", "")

        verifier = secrets.token_urlsafe(48)
        challenge = (
            base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest())
            .decode()
            .rstrip("=")
        )
        redirect_uri = "https://claude.ai/api/mcp/auth_callback"
        authorize_params = {
            "response_type": "code",
            "client_id": client_id,
            "redirect_uri": redirect_uri,
            "state": "xyz789",
            "code_challenge": challenge,
            "code_challenge_method": "S256",
        }
        r = await c.get("http://127.0.0.1:8898/oauth/authorize", params=authorize_params)
        check("consent screen renders", r.status_code == 200 and "Allow access" in r.text)

        form = {k: v for k, v in authorize_params.items() if k != "response_type"}
        r = await c.post(
            "http://127.0.0.1:8898/oauth/authorize",
            data={**form, "password": "wrong-password"},
        )
        check("wrong consent password is rejected", r.status_code == 401, str(r.status_code))

        r = await c.post(
            "http://127.0.0.1:8898/oauth/authorize",
            data={**form, "password": "hunter2"},
            follow_redirects=False,
        )
        ok = r.status_code == 302
        location = r.headers.get("location", "")
        qs = parse_qs(urlparse(location).query)
        code = qs.get("code", [""])[0]
        check("correct password redirects with code", ok and bool(code), f"{r.status_code} {location[:80]}")
        check("state is preserved", qs.get("state", [""])[0] == "xyz789")

        r = await c.post(
            "http://127.0.0.1:8898/oauth/token",
            data={
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": redirect_uri,
                "client_id": client_id,
                "code_verifier": "wrong-verifier-entirely",
            },
        )
        check("bad PKCE verifier is rejected", r.status_code == 400, str(r.status_code))

        r = await c.post(
            "http://127.0.0.1:8898/oauth/token",
            data={
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": redirect_uri,
                "client_id": client_id,
                "code_verifier": verifier,
            },
        )
        tok = r.json() if r.status_code == 200 else {}
        oauth_token = tok.get("access_token", "")
        check("token exchange succeeds", bool(oauth_token), r.text[:160])

        r = await c.post(
            "http://127.0.0.1:8898/oauth/token",
            data={"grant_type": "refresh_token", "refresh_token": tok.get("refresh_token", "")},
        )
        check("refresh token works", r.status_code == 200 and "access_token" in r.text, r.text[:120])

        print("\n[4] MCP over the OAuth token")
        init = await initialize(c, oauth_token)
        check(
            "initialize handshake",
            init.get("result", {}).get("serverInfo", {}).get("name") == "chakra",
            json.dumps(init)[:200],
        )

        listed = await mcp_call(c, oauth_token, {"jsonrpc": "2.0", "id": 2, "method": "tools/list"})
        tools = listed.get("result", {}).get("tools", [])
        names = [t.get("name") for t in tools]
        check("tools/list returns read, add, update", sorted(names) == ["add_chakra_task", "get_chakra_tasks", "update_chakra_task"], str(names))
        check("there is no delete tool", not any("delete" in (n or "") for n in names), str(names))
        props = next((t["inputSchema"]["properties"] for t in tools if t["name"] == "get_chakra_tasks"), {})
        check(
            "read tool exposes all filters",
            set(props) == {"status", "bucket", "time_horizon", "weightage", "life_area", "search", "limit"},
            str(sorted(props)),
        )

        print("\n[5] Tool call against real task shapes")

        async def call_tool(args: dict, name: str = "get_chakra_tasks") -> str:
            res = await mcp_call(
                c,
                oauth_token,
                {
                    "jsonrpc": "2.0",
                    "id": 9,
                    "method": "tools/call",
                    "params": {"name": name, "arguments": args},
                },
            )
            if "error" in res:
                return f"ERROR {json.dumps(res['error'])[:200]}"
            return res["result"]["content"][0]["text"]

        text = await call_tool({})
        ok = text.startswith("{")
        data = json.loads(text) if ok else {}
        expected_pending = len([t for t in TASKS if not t.get("completed")])
        check("default returns pending tasks", data.get("count") == expected_pending,
              f"got {data.get('count')} want {expected_pending} :: {text[:160]}")
        check("respects limit of 100", len(data.get("tasks", [])) == 100, str(len(data.get("tasks", []))))

        first = data.get("tasks", [{}])[0]
        check("chapter is mapped from ch", "chapter" in first or all("ch" not in t for t in data.get("tasks", [])),
              str(first)[:160])
        check("raw ch key is not leaked", all("ch" not in t for t in data.get("tasks", [])))
        dated = [t.get("due_date") for t in data.get("tasks", []) if t.get("due_date")]
        check("dated tasks first, soonest first", dated == sorted(dated) and (not dated or data["tasks"][0].get("due_date") == dated[0]),
              str(dated[:5]))
        check("days_sitting is computed for every task", all("days_sitting" in t for t in data.get("tasks", [])))
        allp = json.loads(await call_tool({"status": "all", "limit": 500}))
        has = lambda k: any(k in t for t in allp["tasks"])
        check("new fields reach Claude (due_date, details, contacts)", has("due_date") and has("details") and has("contacts"),
              str([k for k in ("due_date", "details", "contacts") if not has(k)]))

        text = await call_tool({"bucket": "Vishram"})
        data = json.loads(text) if text.startswith("{") else {}
        want = len([t for t in TASKS if t.get("bucket") == "Vishram" and not t.get("completed")])
        check("bucket filter", data.get("count") == want, f"got {data.get('count')} want {want}")

        text = await call_tool({"time_horizon": "thisWeek"})
        data = json.loads(text) if text.startswith("{") else {}
        want = len([t for t in TASKS if t.get("time_horizon") == "thisWeek" and not t.get("completed")])
        check("time_horizon filter", data.get("count") == want, f"got {data.get('count')} want {want}")

        text = await call_tool({"weightage": "W2", "status": "all"})
        data = json.loads(text) if text.startswith("{") else {}
        want = len([t for t in TASKS if t.get("weightage") == "W2"])
        check("weightage filter with status=all", data.get("count") == want, f"got {data.get('count')} want {want}")

        text = await call_tool({"bucket": "NoSuchBucket"})
        check("empty result is a clean message", text == "No tasks match those filters.", text[:120])

        print("\n[5b] Add and update")
        from datetime import date as _d, timedelta as _td
        due = (_d.today() + _td(days=5)).isoformat()
        text = await call_tool({"title": "ZZ smoke call the framer", "details": "Ask about matte frames",
                                "due_date": due, "due_time": "17:30", "life_area": "Picturizze", "weightage": "W1",
                                "contacts": [{"name": "Raj", "phones": ["2145551234"], "cc": "+1"}],
                                "follow_up_text": "Pick up the frames", "follow_up_gap_days": 3}, "add_chakra_task")
        added = json.loads(text).get("added", {}) if text.startswith("{") else {}
        post = next((b for m, _, b in WRITES if m == "POST"), {})
        check("add creates the task", added.get("title") == "ZZ smoke call the framer", text[:200])
        check("add stores date, time, horizon stamps", post.get("due_date") == due and post.get("due_time") == "17:30"
              and post.get("due_date_at") == post.get("deadline_set_at") and post.get("time_horizon") in ("thisWeek", "nextWeek", "today"), str(post)[:300])
        check("add stores area as the app does", post.get("life_area") == "Picturizze" and post.get("category") == "Picturizze")
        check("add stores contacts, details, follow-up", post.get("contacts", [{}])[0].get("phones") == ["2145551234"]
              and post.get("details") == "Ask about matte frames" and post.get("follow_up_gap") == 3)
        check("add starts bucket history", post.get("state_history", [{}])[0].get("bucket") == "Karya")
        tid = post.get("id")

        text = await call_tool({"title": "ZZ smoke undated"}, "add_chakra_task")
        undated = [b for m, _, b in WRITES if m == "POST"][-1]
        check("undated task follows the app rule (this week, no date given)",
              undated.get("time_horizon") == "thisWeek" and undated.get("no_date_given") is True, str(undated)[:200])

        text = await call_tool({"title": "x", "due_date": "2020-01-01"}, "add_chakra_task")
        check("a past date is refused", text.startswith("Not added"), text[:120])

        n0 = len(WRITES)
        text = await call_tool({"task_id": tid, "bucket": "Dhairya", "append_details": "Raj prefers mornings"}, "update_chakra_task")
        patch = WRITES[-1][2] if len(WRITES) > n0 else {}
        check("update moves bucket and records history", patch.get("bucket") == "Dhairya"
              and patch.get("state_history", [{}])[-1].get("bucket") == "Dhairya" and patch.get("transition_count") == 1, str(patch)[:300])
        check("update appends details", patch.get("details") == "Ask about matte frames\n\nRaj prefers mornings")
        check("update sends only changed fields", set(patch) == {"bucket", "details", "state_history", "transition_count"}, str(sorted(patch)))

        n0 = len(WRITES)
        text = await call_tool({"task_id": tid, "completed": True}, "update_chakra_task")
        res = json.loads(text) if text.startswith("{") else {}
        new_posts = [b for m, _, b in WRITES[n0:] if m == "POST"]
        fu = new_posts[0] if new_posts else {}
        from app.chakra_client import now_local as _nl; due_fu = (_nl().date() + _td(days=3)).isoformat()
        check("completing creates the follow-up", fu.get("title") == "Pick up the frames" and fu.get("due_date") == due_fu
              and fu.get("follows_id") == tid and fu.get("weightage") == "W2", str(fu)[:300])
        patches = [b for m, _, b in WRITES[n0:] if m == "PATCH"]
        cpatch = patches[-1] if patches else {}
        check("completion is recorded as the app does", cpatch.get("completed") is True and bool(cpatch.get("completed_timestamp"))
              and cpatch.get("state_history", [{}])[-1].get("bucket") == "Completed" and cpatch.get("follow_up_spawned_id") == fu.get("id"),
              str(cpatch)[:300])
        check("result reports the follow-up", "follow_up_created" in res, text[:200])

        text = await call_tool({"task_id": tid, "completed": True}, "update_chakra_task")
        check("completing twice changes nothing", text.startswith("Nothing to change"), text[:120])
        text = await call_tool({"task_id": "no_such_task", "title": "x"}, "update_chakra_task")
        check("unknown id is a clean message", text.startswith("Not changed: No task with id"), text[:120])
        text = await call_tool({"search": "smoke framer", "status": "all"})
        check("search finds by words", text.startswith("{") and json.loads(text)["count"] == 1, text[:160])
        check("nothing was ever deleted", not any(m == "DELETE" for m, _, _ in WRITES))

        print("\n[6] Static bearer token path")
        init = await initialize(c, "static-token-abc123")
        check(
            "MCP_ACCESS_TOKEN also authenticates",
            init.get("result", {}).get("serverInfo", {}).get("name") == "chakra",
            json.dumps(init)[:160],
        )

    print(f"\n{len(PASSES)} passed, {len(FAILS)} failed")
    if FAILS:
        print("Failed: " + ", ".join(FAILS))
    return 1 if FAILS else 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
