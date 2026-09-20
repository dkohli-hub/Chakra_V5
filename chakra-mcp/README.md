# Chakra MCP Connector

Read-only MCP server that lets Claude pull DK's Chakra tasks directly into a
conversation. Runs as its own Render service; the main Chakra app is untouched.

## How it works

```
Claude  --https + OAuth-->  chakra-mcp  --short-lived JWT-->  chakra-v5-backend  -->  Postgres
```

It calls the Chakra backend's existing `GET /tasks` rather than querying Postgres
directly. Three reasons: the service is read-only by construction, user scoping is
already enforced by the backend, and there is no second copy of the schema to drift.

Auth accepts **either** an OAuth 2.1 access token **or** a static bearer token, so
whichever way Claude's connector dialog works, this is already handled.

## Layout

| File | Purpose |
|---|---|
| `app/server.py` | The MCP server and the `get_chakra_tasks` tool |
| `app/chakra_client.py` | Mints the read token, calls `GET /tasks`, shapes rows |
| `app/auth.py` | Bearer gate on `/mcp`, issues and verifies tokens |
| `app/oauth.py` | OAuth 2.1: discovery, registration, consent, token exchange |
| `app/main.py` | Wires it together into one ASGI app |
| `smoke_test.py` | 28 end-to-end checks against a stub Chakra API |

## Local run

```bash
python -m venv .venv
.venv/Scripts/python.exe -m pip install -r requirements.txt
cp .env.example .env        # then fill it in
.venv/Scripts/python.exe -m uvicorn app.main:app --reload --port 8000
```

Generate the two secrets:

```bash
python -c "import secrets; print(secrets.token_hex(32))"   # MCP_ACCESS_TOKEN
python -c "import secrets; print(secrets.token_hex(32))"   # MCP_SECRET
```

`MCP_LOGIN_PASSWORD` is what DK types on the consent screen — make it something he
can retype from a password manager, not a 64-char hex string.

Run the test suite (needs no database and no network):

```bash
.venv/Scripts/python.exe smoke_test.py
```

## Deploy to Render

1. Push this folder to the repo.
2. **New → Web Service**, root directory `chakra-mcp`, or use the included
   `render.yaml`.
3. Build: `pip install -r requirements.txt`
   Start: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
4. Environment variables:

   | Key | Value |
   |---|---|
   | `CHAKRA_API_URL` | `https://chakra-v5-backend.onrender.com` |
   | `SECRET_KEY` | **byte-identical** to chakra-v5-backend's `SECRET_KEY` |
   | `CHAKRA_USER_ID` | `dk` |
   | `MCP_ACCESS_TOKEN` | generated above |
   | `MCP_LOGIN_PASSWORD` | the consent-screen password |
   | `MCP_SECRET` | generated above |
   | `PUBLIC_URL` | the Render URL, set after the first deploy |
   | `TIMEZONE` | `America/Chicago` |

5. Deploy, copy the assigned URL into `PUBLIC_URL`, redeploy.

**Use the Starter plan, not Free.** Free services spin down after ~15 minutes idle
and DK's first query each morning would time out.

`PUBLIC_URL` matters beyond cosmetics: it drives the OAuth discovery URLs and the
SDK's DNS-rebinding allowlist. Unset in production, Claude's requests get rejected.

### Verify the deploy

```bash
curl https://chakra-mcp.onrender.com/health
curl https://chakra-mcp.onrender.com/.well-known/oauth-authorization-server
curl -i -X POST https://chakra-mcp.onrender.com/mcp          # expect 401 + WWW-Authenticate
```

Then confirm real data comes back:

```bash
curl -X POST https://chakra-mcp.onrender.com/mcp \
  -H "Authorization: Bearer $MCP_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "MCP-Protocol-Version: 2025-06-18" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"get_chakra_tasks","arguments":{"time_horizon":"today"}}}'
```

## Send DK

- The connector URL: `https://chakra-mcp.onrender.com/mcp`
- The consent-screen password — **over a secure channel, not chat or email**
- Settings → Connectors → Add custom connector → paste URL → Connect → type the
  password on the Chakra consent screen.

Prompts that work well:

- "What's in my Karya bucket for today?"
- "Show me everything W4 or W5 that's still pending."
- "Build me a calendar for tomorrow from my Chakra tasks this week."
- "Which tasks have been sitting longest?"

## The tool

`get_chakra_tasks(status, bucket, time_horizon, weightage, life_area, limit)`

- `status` — `pending` (default), `done`, `all`
- `bucket` — Karya, Dhairya, Manan, Manthan, Vishram, Prarabdha, Tyaga
- `time_horizon` — today, thisWeek, nextWeek, thisMonth, thisYear, Q3
- `weightage` — W1 (lightest) to W5 (heaviest)
- `life_area` — Personal/Family, Work/Employment, Picturizze, Other

Roughly half of all tasks have no `time_horizon` or `weightage` set, so filtering
on those fields excludes them. That is the data, not a bug.

Returned rows carry `chapter` (the schema's `ch`), `aging_days`, and — only when a
task has actually moved — `moved_from` and `times_moved`.

## Troubleshooting

| Symptom | Cause |
|---|---|
| Tool returns a 401 message | `SECRET_KEY` here does not match the Chakra backend |
| Claude can't complete OAuth | `PUBLIC_URL` unset or not matching the real URL |
| First call each day times out | Service is on the Free plan and spun down |
| Timestamps look off by an hour | `TIMEZONE` wrong; `America/Chicago` handles DST itself |
| `ZoneInfoNotFoundError` locally | `pip install tzdata` (Windows has no system tz database) |

## Note on the schema

Chakra has no `users` table — accounts live in the backend's `USER_ACCOUNTS`
environment variable, and `user_id` is the string `dk`, not an integer. Any guide
describing a `users` table with an `email` column is describing a different system.
