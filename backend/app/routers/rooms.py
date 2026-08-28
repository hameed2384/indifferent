from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from ..db import db
from ..deps import get_current_user
from ..hubs import maybe_run_coach
from ..models import MatchFeedback, User

router = APIRouter()


def _require_participant(room: dict, user_id: str):
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    if user_id not in (room["user_a"], room["user_b"]):
        raise HTTPException(status_code=403, detail="Not a participant")


@router.get("/rooms/{room_id}")
async def get_room(room_id: str, user: User = Depends(get_current_user)):
    room = await db.rooms.find_one({"room_id": room_id}, {"_id": 0})
    _require_participant(room, user.user_id)
    partner_id = room["user_b"] if room["user_a"] == user.user_id else room["user_a"]
    partner = await db.users.find_one({"user_id": partner_id}, {"_id": 0})
    return {
        "room_id": room_id,
        "opposition_score": room["opposition_score"],
        "topics": room["topics"],
        "partner": {
            "user_id": partner["user_id"],
            "display_name": partner.get("display_name") or partner["name"],
            "stance": partner.get("stance"),
            "id_verified": partner.get("id_verified", False),
        },
        "my_role": "a" if room["user_a"] == user.user_id else "b",
    }


class ChatSend(BaseModel):
    text: str


@router.post("/rooms/{room_id}/chat")
async def send_chat(room_id: str, payload: ChatSend, user: User = Depends(get_current_user)):
    """Send a chat message. Replaces the old WS 'chat' frame — clients poll
    GET /rooms/{room_id}/messages for new messages (and coach nudges) instead
    of receiving a push."""
    room = await db.rooms.find_one({"room_id": room_id}, {"_id": 0})
    _require_participant(room, user.user_id)

    text = payload.text.strip()[:1000]
    if not text:
        raise HTTPException(status_code=400, detail="Empty message")
    now = datetime.now(timezone.utc).isoformat()
    await db.chat_messages.insert_one({
        "room_id": room_id, "sender_id": user.user_id, "text": text, "created_at": now,
    })
    await maybe_run_coach(room_id, room)
    return {"ok": True, "ts": now}


@router.get("/rooms/{room_id}/messages")
async def poll_messages(room_id: str, since: Optional[str] = None, user: User = Depends(get_current_user)):
    """Poll for chat + coach-nudge activity since a given ISO timestamp
    (pass back the response's server_time as the next `since`). Also echoes
    current publish state so the room screen doesn't need a separate poll."""
    room = await db.rooms.find_one({"room_id": room_id}, {"_id": 0})
    _require_participant(room, user.user_id)

    chat_filter = {"room_id": room_id}
    coach_filter = {"room_id": room_id}
    if since:
        chat_filter["created_at"] = {"$gt": since}
        coach_filter["created_at"] = {"$gt": since}
    msgs = await db.chat_messages.find(chat_filter, {"_id": 0}).sort("created_at", 1).to_list(200)
    nudges = await db.coach_nudges.find(coach_filter, {"_id": 0}).sort("created_at", 1).to_list(20)

    events = [{"type": "chat", "from": m["sender_id"], "text": m["text"], "ts": m["created_at"]} for m in msgs]
    events += [{"type": "coach", **n, "ts": n["created_at"]} for n in nudges]
    events.sort(key=lambda e: e["ts"])

    return {
        "events": events,
        "is_public": bool(room.get("is_public", False)),
        "publish_a": bool(room.get("publish_a", False)),
        "publish_b": bool(room.get("publish_b", False)),
        "server_time": datetime.now(timezone.utc).isoformat(),
    }


@router.post("/rooms/{room_id}/feedback")
async def submit_feedback(room_id: str, fb: MatchFeedback, user: User = Depends(get_current_user)):
    await db.feedback.insert_one({
        "room_id": room_id,
        "user_id": user.user_id,
        "rating": fb.rating,
        "mind_changed": fb.mind_changed,
        "notes": fb.notes,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    inc = {"debates": 1}
    if fb.mind_changed:
        inc["minds_changed"] = 1
    await db.users.update_one({"user_id": user.user_id}, {"$inc": inc})
    await db.rooms.update_one({"room_id": room_id}, {"$set": {"status": "ended"}})
    return {"ok": True}


@router.get("/dashboard/stats")
async def dashboard_stats(user: User = Depends(get_current_user)):
    recent = await db.feedback.find({"user_id": user.user_id}, {"_id": 0}).sort("created_at", -1).to_list(10)
    return {
        "debates": user.debates,
        "minds_changed": user.minds_changed,
        "stance": user.stance.model_dump() if user.stance else None,
        "recent_feedback": recent,
    }
