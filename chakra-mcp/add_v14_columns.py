"""Add the three optional V14 columns (Set Deadline picker) to the production `tasks` table.

Run by a human, once, BEFORE deploying the backend commit that adds
due_date / due_time / duration_min to the Task model.

    .venv/Scripts/python.exe add_v14_columns.py "postgresql://user:pass@host/db"

Safe by design:
  - Only ADDs empty columns. Never updates, deletes or rewrites a row.
  - IF NOT EXISTS, so running it twice does nothing the second time.
  - One transaction: if the row count changes, it rolls back.
"""

import sys

import psycopg

DDL = [
    "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS due_date VARCHAR(10)",
    "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS due_time VARCHAR(5)",
    "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS duration_min INTEGER",
]
NEW = ("due_date", "due_time", "duration_min")


def v14_columns(conn):
    rows = conn.execute(
        "SELECT column_name FROM information_schema.columns "
        "WHERE table_name = 'tasks' AND column_name = ANY(%s)",
        (list(NEW),),
    ).fetchall()
    return sorted(r[0] for r in rows)


def main() -> int:
    if len(sys.argv) != 2 or not sys.argv[1].startswith("postgres"):
        print(__doc__)
        return 1
    url = sys.argv[1]
    if "sslmode" not in url:
        url += ("&" if "?" in url else "?") + "sslmode=require"

    with psycopg.connect(url, connect_timeout=20) as conn:
        before = conn.execute("SELECT count(*) FROM tasks").fetchone()[0]
        print(f"Rows before:        {before}")
        print(f"V14 columns before:  {v14_columns(conn) or 'none'}")
        for d in DDL:
            conn.execute(d)
        after = conn.execute("SELECT count(*) FROM tasks").fetchone()[0]
        if after != before:
            conn.rollback()
            print(f"ABORT: row count changed {before} -> {after}. Rolled back, nothing changed.")
            return 1
        # Leaving the `with` block commits.

    with psycopg.connect(url, connect_timeout=20) as conn:
        cols = v14_columns(conn)
        rows = conn.execute("SELECT count(*) FROM tasks").fetchone()[0]
    print(f"Rows after:         {rows}")
    print(f"V14 columns after:   {cols}")
    if cols == sorted(NEW) and rows == before:
        print("\nDONE. All 3 columns present, no rows changed. Safe to deploy the V14 backend.")
        return 0
    print("\nSomething is off — do not deploy the V14 backend yet.")
    return 1


if __name__ == "__main__":
    sys.exit(main())
