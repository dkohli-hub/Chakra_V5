"""Full-fidelity backup of every Chakra task for one user.

The MCP connector returns a trimmed view of each task, which is fine for reading
but lossy as a backup. This hits the backend's GET /tasks directly and writes
every column exactly as stored, so the file is sufficient to restore from via
POST /tasks/import.

Read-only. It has no write or delete path.

    .venv/Scripts/python.exe backup_full.py

Needs CHAKRA_API_URL and SECRET_KEY in .env (same values as the Render service).
"""

import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import httpx
from jose import jwt

from app.config import settings


def main() -> int:
    if settings.SECRET_KEY in ("", "change-me"):
        print("SECRET_KEY is not set. Copy it from chakra-v5-backend into .env.")
        return 1

    token = jwt.encode(
        {
            "sub": settings.CHAKRA_USER_ID,
            "name": settings.CHAKRA_DISPLAY_NAME,
            "exp": datetime.now(timezone.utc) + timedelta(minutes=5),
        },
        settings.SECRET_KEY,
        algorithm="HS256",
    )

    url = f"{settings.CHAKRA_API_URL.rstrip('/')}/tasks"
    print(f"GET {url} as {settings.CHAKRA_USER_ID} ...")
    resp = httpx.get(url, headers={"Authorization": f"Bearer {token}"}, timeout=60.0)
    if resp.status_code == 401:
        print("401 from the Chakra API - SECRET_KEY here does not match the backend.")
        return 1
    resp.raise_for_status()
    tasks = resp.json()

    stamp = datetime.now().strftime("%Y-%m-%d_%H%M")
    out = Path(__file__).parent.parent / f"chakra-full-backup-{stamp}.json"
    out.write_text(json.dumps(tasks, indent=2, ensure_ascii=False), encoding="utf-8")

    completed = sum(1 for t in tasks if t.get("completed"))
    print(f"\nWrote {out}")
    print(f"  {len(tasks)} tasks ({completed} completed, {len(tasks) - completed} pending)")
    print(f"  {out.stat().st_size:,} bytes")
    print("\nRestore path if ever needed: POST this array to /tasks/import")
    return 0


if __name__ == "__main__":
    sys.exit(main())
