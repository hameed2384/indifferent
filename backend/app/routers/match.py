import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from ..db import db
from ..deps import get_current_user
from ..llm import generate_topics
from ..models import StanceScores, User

router = APIRouter()


def opposition_score(a: StanceScores, b: StanceScores) -> float:
    """Higher = more opposing. Manhattan distance across axes, max ~40."""
    return abs(a.economic - b.economic) + abs(a.social - b.social)


@router.post("/match/enqueue")
async def enqueue(user: User = Depends(get_current_user)):
    if not user.onboarded:
        raise HTTPException(status_code=400, detail="Complete onboarding first")
    if not user.id_verified:
        raise HTTPException(status_code=400, detail="ID verification required")

    # Look for the best opposition already in queue
    candidates = await db.match_queue.find({"user_id": {"$ne": user.user_id}}, {"_id": 0}).to_list(50)
    best = None
    best_score = -1.0
    for c in candidates:
        cstance = StanceScores(**c["stance"])
        score = opposition_score(StanceScores(**user.stance.model_dump()), cstance)
        if score > best_score:
            best_score = score
            best = c

    # Require some opposition (score > 6) — else keep waiting; but for MVP accept any
    if best:
        room_id = f"room_{uuid.uuid4().hex[:12]}"
        topics = await generate_topics(user.stance, StanceScores(**best["stance"]))
        await db.rooms.insert_one({
            "room_id": room_id,
            "user_a": user.user_id,
            "user_b": best["user_id"],
            "opposition_score": best_score,
            "topics": topics,
            "categories": ["Politics"],
            "created_at": datetime.now(timezone.utc).isoformat(),
            "status": "active",
        })
        await db.match_queue.delete_one({"user_id": best["user_id"]})
        # Notify partner via a "pending_room" record they'll poll
        await db.pending_rooms.insert_one({
            "user_id": best["user_id"],
            "room_id": room_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        return {"matched": True, "room_id": room_id, "opposition_score": best_score, "topics": topics}

    # No candidate — enqueue self
    await db.match_queue.update_one(
        {"user_id": user.user_id},
        {"$set": {
            "user_id": user.user_id,
            "stance": user.stance.model_dump(),
            "display_name": user.display_name or user.name,
            "joined_at": datetime.now(timezone.utc).isoformat(),
        }},
        upsert=True,
    )
    return {"matched": False}


@router.get("/match/poll")
async def poll_match(user: User = Depends(get_current_user)):
    pending = await db.pending_rooms.find_one({"user_id": user.user_id}, {"_id": 0})
    if not pending:
        return {"matched": False}
    room = await db.rooms.find_one({"room_id": pending["room_id"]}, {"_id": 0})
    await db.pending_rooms.delete_one({"user_id": user.user_id})
    return {"matched": True, "room_id": pending["room_id"], "opposition_score": room["opposition_score"], "topics": room["topics"]}


@router.post("/match/cancel")
async def cancel_match(user: User = Depends(get_current_user)):
    await db.match_queue.delete_one({"user_id": user.user_id})
    return {"ok": True}
