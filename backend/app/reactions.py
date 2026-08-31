"""Shared like/dislike dedup for clips (routers/clips.py) and debates
(routers/public.py) — both used to be unauthenticated $inc-only counters
with no per-user limit, letting anyone script unlimited vote-stuffing.
"""
from datetime import datetime, timezone

from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError


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


async def toggle_reaction(collection, key_field: str, key_value: str, user_id: str, kind: str) -> str:
    """Like XOR dislike per (item, user) — never both, and reacting the same
    way twice undoes it. Returns "added" (this kind's counter should +1),
    "removed" (this kind's counter should -1 — a toggle-off), "switched"
    (this kind should +1 and the other kind should -1), or "noop" (a losing
    side of a race; no counter change).

    Race-safe by construction rather than by check-then-act: the caller's
    collection must have a unique index on (key_field, user_id) alone (NOT
    including kind) — at most one reaction document can ever exist per user
    per item. The $ne filter below only matches an existing doc of the
    *other* kind (or no doc at all), so a same-kind repeat finds no match
    and — because upsert=True — collides with that other doc's own
    (key_field, user_id) uniqueness, raising DuplicateKeyError. That
    exception is the reliable signal for "toggle off", not a pre-check,
    so two concurrent identical clicks can't both decrement the counter:
    only one delete_one actually removes the doc, the other is a no-op.
    """
    now = datetime.now(timezone.utc).isoformat()
    try:
        # BEFORE image tells insert (None -> "added") apart from switch
        # (a same-item, other-kind doc existed -> "switched") — both take
        # this branch since the $ne filter can't match a same-kind doc.
        prev = await collection.find_one_and_update(
            {key_field: key_value, "user_id": user_id, "kind": {"$ne": kind}},
            {"$set": {key_field: key_value, "user_id": user_id, "kind": kind, "created_at": now}},
            upsert=True,
            return_document=ReturnDocument.BEFORE,
        )
        return "added" if prev is None else "switched"
    except DuplicateKeyError:
        result = await collection.delete_one({key_field: key_value, "user_id": user_id, "kind": kind})
        return "removed" if result.deleted_count > 0 else "noop"
