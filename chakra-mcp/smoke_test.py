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

BACKUP = Path(__file__).parent.parent / "karma-kshetra-backup-2026-07-05.json"

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


stub = Starlette(routes=[Route("/tasks", stub_tasks, methods=["GET"])])


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
        check("tools/list returns get_chakra_tasks", names == ["get_chakra_tasks"], str(names))
        props = tools[0]["inputSchema"]["properties"] if tools else {}
        check(
            "tool exposes all five filters",
            set(props) == {"status", "bucket", "time_horizon", "weightage", "life_area", "limit"},
            str(sorted(props)),
        )

        print("\n[5] Tool call against real task shapes")

        async def call_tool(args: dict) -> str:
            res = await mcp_call(
                c,
                oauth_token,
                {
                    "jsonrpc": "2.0",
                    "id": 9,
                    "method": "tools/call",
                    "params": {"name": "get_chakra_tasks", "arguments": args},
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
        check("sorted by aging_days desc",
              first.get("aging_days") == max(
                  (t.get("aging_days", 0) for t in data.get("tasks", [])), default=-1))

        text = await call_tool({"bucket": "Vishram"})
        data = json.loads(text) if text.startswith("{") else {}
        want = len([t for t in TASKS if t.get("bucket") == "Vishram" and not t.get("completed")])
        check("bucket filter", data.get("count") == want, f"got {data.get('count')} want {want}")

        text = await call_tool({"time_horizon": "thisWeek"})
        data = json.loads(text) if text.startswith("{") else {}
        want = len([t for t in TASKS if t.get("time_horizon") == "thisWeek" and not t.get("completed")])
        check("time_horizon filter", data.get("count") == want, f"got {data.get('count')} want {want}")

        text = await call_tool({"weightage": "W5", "status": "all"})
        data = json.loads(text) if text.startswith("{") else {}
        want = len([t for t in TASKS if t.get("weightage") == "W5"])
        check("weightage filter with status=all", data.get("count") == want, f"got {data.get('count')} want {want}")

        text = await call_tool({"bucket": "NoSuchBucket"})
        check("empty result is a clean message", text == "No tasks match those filters.", text[:120])

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
