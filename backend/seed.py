"""
Seed script: loads karma-kshetra-backup-2026-07-05.json into PostgreSQL for user 'dk'.
Usage: python seed.py
Requires .env with DATABASE_URL set.
"""
import asyncio
import json
import os
import sys
import uuid
from datetime import datetime
from pathlib import Path

# Add project root to path so 'app' module resolves
sys.path.insert(0, str(Path(__file__).parent))

from dotenv import load_dotenv
load_dotenv()

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import select, text

DATABASE_URL = os.environ.get("DATABASE_URL", "")
if not DATABASE_URL:
    print("ERROR: DATABASE_URL not set in .env")
    sys.exit(1)

engine = create_async_engine(DATABASE_URL, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

# Path to the JSON backup — expected in project root
BACKUP_PATH = Path(__file__).parent.parent / "karma-kshetra-backup-2026-07-05.json"
USER_ID = "dk"


def parse_dt(val):
    """Convert ISO string or None to datetime; return None if blank."""
    if not val:
        return None
    if isinstance(val, datetime):
        return val
    try:
        return datetime.fromisoformat(str(val).replace("Z", "+00:00"))
    except Exception:
        return None


def normalise(raw: dict) -> dict:
    """Normalise a single task dict from JSON backup to DB column names."""
    bucket = raw.get("bucket", "Karya")
    if bucket == "Immediate":
        bucket = "Karya"
    ob = raw.get("origin_bucket") or raw.get("originBucket") or bucket
    if ob == "Immediate":
        ob = "Karya"
    sh = raw.get("state_history") or raw.get("stateHistory") or [
        {"bucket": bucket, "timestamp": datetime.utcnow().isoformat()}
    ]
    for entry in sh:
        if isinstance(entry, dict) and entry.get("bucket") == "Immediate":
            entry["bucket"] = "Karya"

    tid = raw.get("id") or f"task_{uuid.uuid4().hex[:12]}"
    return {
        "id": tid,
        "user_id": USER_ID,
        "num": raw.get("num"),
        "title": raw.get("title", ""),
        "bucket": bucket,
        "weightage": raw.get("weightage"),
        "time_horizon": (
            raw.get("time_horizon")
            or raw.get("timeHorizonType")
            or raw.get("timeHorizon")
        ),
        "life_area": raw.get("life_area") or raw.get("lifeArea"),
        "ch": raw.get("ch"),
        "multitask": raw.get("multitask"),
        "origin_bucket": ob,
        "state_history": sh,
        "transition_count": raw.get("transition_count") or raw.get("transitionCount") or 0,
        "completed": raw.get("completed", False),
        "completed_timestamp": parse_dt(
            raw.get("completed_timestamp")
            or raw.get("completedTimestamp")
            or raw.get("completionDate")
        ),
        "entry_timestamp": parse_dt(
            raw.get("entry_timestamp") or raw.get("entryTimestamp")
        ),
        "aging_days": raw.get("aging_days") or raw.get("agingDays") or 0,
    }


async def seed():
    # Ensure tables exist
    from app.database import init_db
    await init_db()

    if not BACKUP_PATH.exists():
        print(f"ERROR: backup file not found at {BACKUP_PATH}")
        sys.exit(1)

    with open(BACKUP_PATH, "r", encoding="utf-8") as f:
        raw = json.load(f)

    tasks_raw = raw if isinstance(raw, list) else raw.get("tasks", [])
    print(f"Loaded {len(tasks_raw)} tasks from backup")

    async with AsyncSessionLocal() as db:
        # Get existing IDs for this user
        result = await db.execute(
            text("SELECT id FROM tasks WHERE user_id = :uid"),
            {"uid": USER_ID},
        )
        existing_ids = {row[0] for row in result.fetchall()}
        print(f"Found {len(existing_ids)} existing tasks for user '{USER_ID}'")

        inserted = 0
        skipped = 0
        for raw_task in tasks_raw:
            norm = normalise(raw_task)
            if norm["id"] in existing_ids:
                skipped += 1
                continue

            # Build INSERT statement using SQLAlchemy core to avoid ORM session issues
            await db.execute(
                text("""
                    INSERT INTO tasks (
                        id, user_id, num, title, bucket, weightage, time_horizon,
                        life_area, ch, multitask, state_history, transition_count,
                        origin_bucket, completed, completed_timestamp, entry_timestamp, aging_days
                    ) VALUES (
                        :id, :user_id, :num, :title, :bucket, :weightage, :time_horizon,
                        :life_area, :ch, :multitask, CAST(:state_history AS jsonb),
                        :transition_count, :origin_bucket, :completed,
                        :completed_timestamp,
                        :entry_timestamp, :aging_days
                    )
                """),
                {
                    "id": norm["id"],
                    "user_id": norm["user_id"],
                    "num": norm["num"],
                    "title": norm["title"],
                    "bucket": norm["bucket"],
                    "weightage": norm["weightage"],
                    "time_horizon": norm["time_horizon"],
                    "life_area": norm["life_area"],
                    "ch": norm["ch"],
                    "multitask": norm["multitask"],
                    "state_history": json.dumps(norm["state_history"]),
                    "transition_count": norm["transition_count"],
                    "origin_bucket": norm["origin_bucket"],
                    "completed": norm["completed"],
                    "completed_timestamp": norm["completed_timestamp"],
                    "entry_timestamp": norm["entry_timestamp"] or datetime.utcnow(),
                    "aging_days": norm["aging_days"],
                },
            )
            inserted += 1

        await db.commit()
        print(f"Done — inserted {inserted} tasks, skipped {skipped} duplicates")


if __name__ == "__main__":
    asyncio.run(seed())
