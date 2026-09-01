"""Lightweight rate limiting with no new infra: reuses the same MongoDB
every other write path already goes through instead of adding Redis just
for this. Fixed-window (not sliding) — simple and good enough to blunt
abuse/spam, not meant to be perfectly fair at the window boundary. Each
call atomically increments a per-(action, identity, window) counter; a TTL
index reclaims old windows on its own so this collection never grows
unbounded.
"""
import time
from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException, Request
from pymongo import ReturnDocument

from .db import db
from .deps import get_current_user_optional


def rate_limit(action: str, limit: int, window_seconds: int):
    """Returns a FastAPI dependency enforcing at most `limit` calls per
    `window_seconds` for the caller. Keys by user_id when signed in,
    falling back to client IP — needed because a few endpoints this guards
    (e.g. spectator comments) allow anonymous callers."""
    async def dep(request: Request, user=Depends(get_current_user_optional)):
        identity = user.user_id if user else f"ip:{request.client.host if request.client else 'unknown'}"
        bucket = int(time.time() // window_seconds)
        key = f"{action}:{identity}:{bucket}"
        doc = await db.rate_limits.find_one_and_update(
            {"_id": key},
            {
                "$inc": {"count": 1},
                "$setOnInsert": {"expires_at": datetime.now(timezone.utc) + timedelta(seconds=window_seconds * 2)},
            },
            upsert=True,
            return_document=ReturnDocument.AFTER,
        )
        if doc["count"] > limit:
            raise HTTPException(status_code=429, detail="Too many requests — slow down and try again shortly")
    return dep
