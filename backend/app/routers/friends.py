"""Friends — a mutual relationship created when a request is accepted (client
brief #4, #11). Deliberately its own collection/endpoints, separate from
follows (one-directional) and subscriptions (paid) — the brief is explicit
these three stay separate systems, not a unified "relationship" table.
"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from ..db import db
from ..deps import get_current_user
from ..models import User
from ..room_utils import find_live_room_id

router = APIRouter()


def _pair_query(a: str, b: str) -> dict:
    return {"$or": [{"user_a": a, "user_b": b}, {"user_a": b, "user_b": a}]}


@router.post("/friends/request/{user_id}")
async def send_friend_request(user_id: str, user: User = Depends(get_current_user)):
    if user_id == user.user_id:
        raise HTTPException(status_code=400, detail="Can't friend yourself")
    target = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if not target.get("allow_friend_requests", True):
        raise HTTPException(status_code=403, detail="This user isn't accepting friend requests")
    existing = await db.friendships.find_one(_pair_query(user.user_id, user_id), {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail=f"Already {existing['status']}")
    now = datetime.now(timezone.utc).isoformat()
    await db.friendships.insert_one({
        "user_a": user.user_id, "user_b": user_id, "status": "pending",
        "requested_by": user.user_id, "created_at": now, "responded_at": None,
    })
    return {"status": "pending"}


@router.post("/friends/accept/{user_id}")
async def accept_friend_request(user_id: str, user: User = Depends(get_current_user)):
    doc = await db.friendships.find_one(_pair_query(user.user_id, user_id), {"_id": 0})
    if not doc or doc["status"] != "pending":
        raise HTTPException(status_code=404, detail="No pending request")
    if doc["requested_by"] == user.user_id:
        raise HTTPException(status_code=400, detail="Can't accept your own request")
    await db.friendships.update_one(
        _pair_query(user.user_id, user_id),
        {"$set": {"status": "accepted", "responded_at": datetime.now(timezone.utc).isoformat()}},
    )
    return {"status": "accepted"}


@router.post("/friends/reject/{user_id}")
async def reject_friend_request(user_id: str, user: User = Depends(get_current_user)):
    doc = await db.friendships.find_one(_pair_query(user.user_id, user_id), {"_id": 0})
    if not doc or doc["status"] != "pending":
        raise HTTPException(status_code=404, detail="No pending request")
    await db.friendships.delete_one(_pair_query(user.user_id, user_id))
    return {"status": "rejected"}


@router.delete("/friends/{user_id}")
async def remove_friend(user_id: str, user: User = Depends(get_current_user)):
    await db.friendships.delete_one(_pair_query(user.user_id, user_id))
    return {"status": "none"}


@router.get("/friends")
async def list_friends(user: User = Depends(get_current_user)):
    docs = await db.friendships.find({"$or": [{"user_a": user.user_id}, {"user_b": user.user_id}]}, {"_id": 0}).to_list(500)
    friends, incoming, outgoing = [], [], []
    for d in docs:
        other_id = d["user_b"] if d["user_a"] == user.user_id else d["user_a"]
        other = await db.users.find_one({"user_id": other_id}, {"_id": 0}) or {}
        entry = {"user_id": other_id, "display_name": other.get("display_name") or other.get("name"), "picture": other.get("picture")}
        if d["status"] == "accepted":
            entry["is_debater"] = bool(other.get("is_debater"))
            entry["live_room_id"] = await find_live_room_id(other_id) if other.get("is_debater") else None
            friends.append(entry)
        elif d["requested_by"] == user.user_id:
            outgoing.append(entry)
        else:
            incoming.append(entry)
    return {"friends": friends, "incoming_requests": incoming, "outgoing_requests": outgoing}


@router.post("/users/me/friend-privacy")
async def set_friend_privacy(allow: bool, user: User = Depends(get_current_user)):
    """Client brief #5 — disable friend requests entirely."""
    await db.users.update_one({"user_id": user.user_id}, {"$set": {"allow_friend_requests": allow}})
    return {"allow_friend_requests": allow}
