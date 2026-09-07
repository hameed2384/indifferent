"""Debate streak — consecutive days with at least one completed debate,
bumped from the same place debates/minds_changed already get incremented
(routers/rooms.py submit_feedback), so "counts as a debate" means exactly
one thing everywhere in the app rather than two slightly different rules.

One streak-freeze per rolling 30 days (Duolingo's "Streak Freeze" is the
precedent — see the small-features proposal this came from): miss exactly
one day and the streak survives once; miss two or more in a row, or a
freeze was already spent in the last 30 days, and it resets to 1.
"""
from datetime import date, datetime, timedelta, timezone

from .db import db

FREEZE_COOLDOWN_DAYS = 30


def _parse_date(s):
    return date.fromisoformat(s) if s else None


async def bump_streak(user_id: str):
    today = datetime.now(timezone.utc).date()
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "streak_count": 1, "streak_last_date": 1, "streak_freeze_used_at": 1})
    last = _parse_date(user.get("streak_last_date")) if user else None
    count = (user or {}).get("streak_count") or 0
    freeze_used = _parse_date((user or {}).get("streak_freeze_used_at"))

    update = {"streak_last_date": today.isoformat()}
    if last == today:
        return  # already counted today — a second debate today isn't a second day
    elif last == today - timedelta(days=1):
        update["streak_count"] = count + 1
    elif last == today - timedelta(days=2) and (freeze_used is None or (today - freeze_used).days >= FREEZE_COOLDOWN_DAYS):
        update["streak_count"] = count + 1  # one skipped day, forgiven
        update["streak_freeze_used_at"] = today.isoformat()
    else:
        update["streak_count"] = 1  # gap too big (or freeze already spent recently) — restart

    await db.users.update_one({"user_id": user_id}, {"$set": update})
