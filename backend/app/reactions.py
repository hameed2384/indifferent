"""Shared like/dislike dedup for clips (routers/clips.py) and debates
(routers/public.py) — both used to be unauthenticated $inc-only counters
with no per-user limit, letting anyone script unlimited vote-stuffing.
"""
from datetime import datetime, timezone


async def react_once(collection, key_field: str, key_value: str, user_id: str, kind: str) -> bool:
    """Records a (item, user, kind) reaction if this is the first time this
    user has done this to this item — returns True the first time (caller
    should $inc its counter), False on every repeat. Race-safe under
    concurrent duplicate requests from the same user: the caller's
    collection must have a unique index on (key_field, user_id, kind), so
    only one of two racing upserts for the same key can ever insert."""
    result = await collection.update_one(
        {key_field: key_value, "user_id": user_id, "kind": kind},
        {"$setOnInsert": {
            key_field: key_value, "user_id": user_id, "kind": kind,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }},
        upsert=True,
    )
    return result.upserted_id is not None
