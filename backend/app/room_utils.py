"""Shared helpers for room membership now that a side can hold more than one
person (party-queue matches, subscriber-join). `user_a`/`user_b` keep their
exact current meaning — each side's primary/founding member — so every
pre-existing call site that reads them directly is unaffected; `extra_a`/
`extra_b` hold any additional occupants (party partners or approved joiners).
"""
from typing import List, Optional

from .db import db


def side_members(room: dict, side: str) -> List[str]:
    primary = room.get(f"user_{side}")
    extra = room.get(f"extra_{side}") or []
    return ([primary] if primary else []) + [m for m in extra if m]


def all_members(room: dict) -> List[str]:
    return side_members(room, "a") + side_members(room, "b")


def member_side(room: dict, user_id: str) -> Optional[str]:
    if user_id in side_members(room, "a"):
        return "a"
    if user_id in side_members(room, "b"):
        return "b"
    return None


def is_participant(room: dict, user_id: str) -> bool:
    return member_side(room, user_id) is not None


def founding_members(room: dict) -> List[str]:
    """Rooms created before group debates have no founding_members field —
    default to [user_a, user_b] (today's behavior exactly), since such a room
    could never have a party member or an approved joiner."""
    stored = room.get("founding_members")
    if stored is not None:
        return stored
    return [m for m in (room.get("user_a"), room.get("user_b")) if m]


def is_founding(room: dict, user_id: str) -> bool:
    return user_id in founding_members(room)


MAX_PER_SIDE = 2  # two friends queuing together, or one original + one approved joiner


async def find_live_room_id(user_id: str) -> Optional[str]:
    """The room_id of a currently-active, public room this user is any kind
    of participant in — powers "live now" indicators on a debater's channel
    and in the friends/following/subscriptions sidebar."""
    r = await db.rooms.find_one(
        {"status": "active", "is_public": True,
         "$or": [{"user_a": user_id}, {"user_b": user_id}, {"extra_a": user_id}, {"extra_b": user_id}]},
        {"_id": 0, "room_id": 1},
    )
    return r["room_id"] if r else None
