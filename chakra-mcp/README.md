# Chakra MCP Connector

MCP server that lets Claude read, add and update DK's Chakra tasks from a
conversation. It cannot delete a task (finish it, or move it to Tyaga). Runs as its
own Render service; the main Chakra app is untouched.

## How it works

```
Claude  --https + OAuth-->  chakra-mcp  --short-lived JWT-->  chakra-v5-backend  -->  Postgres
```

It calls the Chakra backend's own API (`GET /tasks`, `POST /tasks`, `PATCH /tasks/{id}`)
rather than querying Postgres directly: user scoping is already enforced by the backend,
there is no second copy of the schema to drift, and saves follow the web app's rules
(only changed fields are sent; bucket moves go into `state_history`; dates use
America/Chicago with "this week" ending Saturday; completing a task that holds a
follow-up creates the follow-up task).

Auth accepts **either** an OAuth 2.1 access token **or** a static bearer token, so
whichever way Claude's connector dialog works, this is already handled.

## Layout

| File | Purpose |
|---|---|
| `app/server.py` | The MCP server and its three tools |
| `app/chakra_client.py` | Mints the short-lived token, calls the task API, the app's date rules, shapes rows |
| `app/auth.py` | Bearer gate on `/mcp`, issues and verifies tokens |
| `app/oauth.py` | OAuth 2.1: discovery, registration, consent, token exchange |
| `app/main.py` | Wires it together into one ASGI app |
| `smoke_test.py` | 48 end-to-end checks against a stub Chakra API |

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
   | `CHAKRA_API_URL` | `https://chakra-v5-api-service.onrender.com` |
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
- "Add a task to call Raj at the framer on Friday by 4 pm, his number is 214 555 1234."
- "Mark the framer task done." / "Move the Tesla letter to Dhairya." 

## The tools

`get_chakra_tasks(status, bucket, time_horizon, weightage, life_area, search, limit)`

- `status` — `pending` (default), `done`, `all`
- `bucket` — Karya, Dhairya, Vishram, Manan, Manthan, Tyaga, Prarabdha
- `time_horizon` — today, thisWeek, nextWeek, thisMonth, Q3, Q4, thisYear, 1year, 2years, parkingLot
- `weightage` — W1 5 min, W2 30 min, W3 1 hr, W4 half day, W5 full day, W6 30 days
- `life_area` — Personal/Family, Work/Employment, Picturizze, Other
- `search` — words in the title, details, contacts or follow-up text

Rows carry every field the app keeps: due date and time, details, contacts (with
country code), follow-up, links, category, `days_sitting` (counted from the entry
date, as the app does since V21) and, only when a task has moved, `moved_from` /
`times_moved`. Dated tasks come first, soonest first.

`add_chakra_task(title, details, due_date, due_time, time_horizon, weightage, bucket,
life_area, multitask, chapter, contacts, follow_up_text, follow_up_gap_days)` — saves a
task exactly as the app would. No date and not Vishram → due this Saturday, tagged
"no date given". A past date is refused.

`update_chakra_task(task_id, title, details, append_details, due_date, due_time,
clear_due_date, time_horizon, weightage, bucket, life_area, multitask, completed,
add_contacts, follow_up_text, follow_up_gap_days)` — changes only what is passed.

There is no delete tool.

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
