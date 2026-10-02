# html-frontend

DK's prototype HTML, served as a static site and connected to the Chakra backend.

- `index.html` — DK's prototype (currently V14), unchanged except for two edits:
  `USER_ACCOUNTS` is emptied (logins are checked by the backend), and
  `<script src="chakra-api.js"></script>` is added just before `</body>`.
- `chakra-api.js` — replaces only the functions that touch data or keys:
  login, load, save, "Clear completed", AI calls and photo reading.

## Shipping a new prototype version

1. Copy the new HTML over `index.html`.
2. Replace the `USER_ACCOUNTS = [ ... ]` entries with `var USER_ACCOUNTS = [];`.
3. Add `<script src="chakra-api.js"></script>` just before `</body>`.
4. Check the new version for new task fields or new functions that save data.
   New fields need a backend column (see `chakra-mcp/add_v14_columns.py`) and a
   line in `fromApi` / `toApi` in `chakra-api.js`.

## Data safety

- Tasks load from `GET /tasks`; the HTML's built-in sample tasks are never used.
- Saves send only what changed (`POST` new, `PATCH` edited). Nothing re-sends the whole list.
- Only "Clear completed" deletes on the server, one task at a time, after its confirm.
- A failed save is retried every 15 s; the page warns before closing with unsaved changes.

## Render

Static site: root directory `html-frontend`, no build command, publish directory `.`.

## Testing locally

Serve this folder (`python -m http.server 8766`) and open
`http://localhost:8766/?api=http://localhost:8000` to point it at a local backend.
