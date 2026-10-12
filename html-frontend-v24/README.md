# html-frontend-v24

DK's current prototype (V25; the folder keeps its V24 name so the Render site is unchanged), served as its own static site. It uses the same backend
and the same database as `html-frontend` (V22), which stays as it is.

- `index.html` — DK's prototype (now V25), unchanged (it already has
  `var USER_ACCOUNTS = [];` and `<script src="chakra-api.js"></script>`).
- `chakra-api.js` — a copy of the V22 adapter with two V24 additions:
  - after tasks load it calls `remInit()`, which starts the reminders bell and Location AI mode;
  - `locAiCall` (Location AI matching) goes to the backend's `/llm/parse`.

V24 adds no task fields, so no backend or database change is needed.
Tasks are shared with the V22 site: a change in one shows in the other after a reload.

## Reminders and location settings

These, including DK's Google Maps key, are kept only in the browser
(Utilities → Reminders & location), never in git or the backend. The key needs
the Places API (New) and Geocoding API enabled, and is best restricted to this
site's URL. Location needs HTTPS, which Render provides.

## Render

Static site: root directory `html-frontend-v24`, no build command, publish directory `.`.

## Testing locally

Serve this folder (`python -m http.server 8767`) and open
`http://localhost:8767/?api=http://localhost:8000` to point it at a local backend.
