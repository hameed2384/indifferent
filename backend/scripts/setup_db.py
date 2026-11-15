"""One-off database setup: create/update every MongoDB index (app/db.py
create_indexes, including the room-reaction dedupe it runs first).

Production doesn't do this on startup any more (see config.DB_SETUP_ON_STARTUP),
so run it once whenever create_indexes changes, against the production
database:

    cd backend
    MONGO_URL="<production connection string>" DB_NAME="<production db name>" \
        uv run --frozen python -m scripts.setup_db

Safe to re-run: index creation and the dedupe are both no-ops once applied.
Without MONGO_URL/DB_NAME set in the shell it uses backend/.env (local dev).
"""
import asyncio
import time

from app.config import DB_NAME
from app.db import client, create_indexes


async def main() -> None:
    print(f"Setting up indexes on database {DB_NAME!r}...")
    start = time.perf_counter()
    await create_indexes()
    print(f"Done in {time.perf_counter() - start:.1f}s.")
    client.close()


if __name__ == "__main__":
    asyncio.run(main())
