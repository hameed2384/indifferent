"""Private friend-to-friend chat + call (client brief #14) — deliberately its
OWN router, its OWN collections, and its OWN LiveKit room namespace. This
file never imports hubs.py (the debate coach / topic-drift watcher) and has
no code path into Gemini — that's the actual "AI-blind" guarantee: it's
structural (this file simply contains no AI call site), not a config flag
someone could flip by mistake. The one AI call in here (generate_topics, in
go_public below) only ever sees each side's already-public per-tag
TopicStance data, never anything from private_messages or the private call
itself.

Friends-only, checked against the same `friendships` collection
routers/friends.py uses — no separate relationship concept for this.
"""
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from livekit import api as lk_api
from pydantic import BaseModel

from ..config import LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_URL
from ..db import db
from ..deps import get_current_user, require_xhr
from ..llm import generate_topics
from ..models import User
from ..topic_stances import get_tag_positions, shared_tag_opposition

router = APIRouter()


def _pair_key(a: str, b: str) -> str:
    return "_".join(sorted([a, b]))


async def _require_friends(user_id: str, friend_id: str):
    doc = await db.friendships.find_one(
        {"status": "accepted", "$or": [{"user_a": user_id, "user_b": friend_id}, {"user_a": friend_id, "user_b": user_id}]},
        {"_id": 0},
    )
    if not doc:
        raise HTTPException(status_code=403, detail="Private chat is friends-only")


@router.get("/private/threads")
async def list_threads(user: User = Depends(get_current_user)):
    docs = await db.friendships.find(
        {"status": "accepted", "$or": [{"user_a": user.user_id}, {"user_b": user.user_id}]}, {"_id": 0}
    ).to_list(500)
    out = []
    for d in docs:
        friend_id = d["user_b"] if d["user_a"] == user.user_id else d["user_a"]
        friend = await db.users.find_one({"user_id": friend_id}, {"_id": 0}) or {}
        pair = _pair_key(user.user_id, friend_id)
        last = await db.private_messages.find_one({"pair_key": pair}, {"_id": 0}, sort=[("created_at", -1)])
        out.append({
            "friend_id": friend_id,
            "display_name": friend.get("display_name") or friend.get("name") or "Friend",
            "picture": friend.get("picture"),
            "last_message": last["text"] if last else None,
            "last_at": last["created_at"] if last else None,
        })
    out.sort(key=lambda t: t["last_at"] or "", reverse=True)
    return {"threads": out}


class PrivateMessageIn(BaseModel):
    text: str


@router.get("/private/messages/{friend_id}")
async def get_messages(friend_id: str, since: Optional[str] = None, user: User = Depends(get_current_user)):
    await _require_friends(user.user_id, friend_id)
    pair = _pair_key(user.user_id, friend_id)
    query: dict = {"pair_key": pair}
    if since:
        query["created_at"] = {"$gt": since}
    msgs = await db.private_messages.find(query, {"_id": 0}).sort("created_at", 1).to_list(500)
    call = await db.private_calls.find_one({"pair_key": pair}, {"_id": 0})
    return {
        "messages": msgs,
        "public_room_id": call.get("room_id") if call else None,
        "server_time": datetime.now(timezone.utc).isoformat(),
    }


@router.post("/private/messages/{friend_id}")
async def send_message(friend_id: str, payload: PrivateMessageIn, user: User = Depends(get_current_user)):
    await _require_friends(user.user_id, friend_id)
    text = payload.text.strip()[:2000]
    if not text:
        raise HTTPException(status_code=400, detail="Empty message")
    now = datetime.now(timezone.utc).isoformat()
    await db.private_messages.insert_one({
        "pair_key": _pair_key(user.user_id, friend_id), "sender_id": user.user_id, "text": text, "created_at": now,
    })
    return {"ok": True, "ts": now}


def _mint_private_call_token(identity: str, name: str, call_room: str) -> str:
    grants = lk_api.VideoGrants(room_join=True, room=call_room, can_publish=True, can_subscribe=True, can_publish_data=True)
    at = (
        lk_api.AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
        .with_ttl(timedelta(hours=2)).with_identity(identity).with_name(name).with_grants(grants)
    )
    return at.to_jwt()


@router.post("/private/calls/{friend_id}/token")
async def private_call_token(friend_id: str, user: User = Depends(get_current_user)):
    """A LiveKit room namespace ('private_<pair>') entirely separate from any
    public debate room — no shared code path with routers/livekit.py."""
    await _require_friends(user.user_id, friend_id)
    if not (LIVEKIT_URL and LIVEKIT_API_KEY and LIVEKIT_API_SECRET):
        raise HTTPException(status_code=503, detail="Calling isn't configured yet")
    call_room = f"private_{_pair_key(user.user_id, friend_id)}"
    token = _mint_private_call_token(f"user-{user.user_id}", user.display_name or user.name, call_room)
    return {"server_url": LIVEKIT_URL, "participant_token": token}


@router.post("/private/calls/{friend_id}/go-public")
async def go_public(friend_id: str, user: User = Depends(get_current_user), _xhr: None = Depends(require_xhr)):
    """Either friend can turn the call into a normal public debate. This
    literally creates a normal rooms doc and hands off to the EXISTING
    /rooms/{id}/publish dual-consent flow from that point on — creating it
    does not itself make anything public; both sides still separately opt in
    once they're in the room, same as any matched debate."""
    await _require_friends(user.user_id, friend_id)
    friend_doc = await db.users.find_one({"user_id": friend_id}, {"_id": 0})
    if not friend_doc:
        raise HTTPException(status_code=404, detail="Friend not found")
    friend = User(**friend_doc)
    if not (user.onboarded and user.id_verified and friend.onboarded and friend.id_verified):
        raise HTTPException(status_code=400, detail="Both of you need to finish onboarding + verification first")

    topics = []
    if user.interest_tags and friend.interest_tags:
        my_positions = await get_tag_positions(user.user_id, user.interest_tags)
        friend_positions = await get_tag_positions(friend_id, friend.interest_tags)
        best = shared_tag_opposition(my_positions, friend_positions)
        if best:
            tag, _ = best
            topics = await generate_topics(tag, my_positions[tag], friend_positions[tag])

    room_id = f"room_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc).isoformat()
    await db.rooms.insert_one({
        "room_id": room_id, "user_a": user.user_id, "user_b": friend_id,
        "extra_a": [], "extra_b": [], "founding_members": [user.user_id, friend_id],
        "opposition_score": None, "topics": topics, "categories": [],
        "created_at": now, "status": "active",
    })
    pair = _pair_key(user.user_id, friend_id)
    await db.private_calls.update_one(
        {"pair_key": pair}, {"$set": {"pair_key": pair, "room_id": room_id, "updated_at": now}}, upsert=True
    )
    return {"room_id": room_id}


@router.post("/private/calls/{friend_id}/clear")
async def clear_call_flag(friend_id: str, user: User = Depends(get_current_user), _xhr: None = Depends(require_xhr)):
    """Dismiss the "your friend went public" prompt after joining or passing,
    so a stale room_id doesn't keep re-surfacing it."""
    await db.private_calls.delete_one({"pair_key": _pair_key(user.user_id, friend_id)})
    return {"ok": True}
