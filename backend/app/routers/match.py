import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from ..db import db
from ..deps import get_current_user
from ..llm import generate_topics
from ..models import PartyEnqueueRequest, StanceScores, User

router = APIRouter()


def opposition_score(a: StanceScores, b: StanceScores) -> float:
    """Higher = more opposing. Manhattan distance across axes, max ~40."""
    return abs(a.economic - b.economic) + abs(a.social - b.social)


def _avg_stance(stances: list) -> StanceScores:
    n = len(stances)
    return StanceScores(
        economic=sum(s.economic for s in stances) / n,
        social=sum(s.social for s in stances) / n,
    )


async def _already_queued(user_ids: list) -> bool:
    if await db.match_queue.find_one({"user_id": {"$in": user_ids}}, {"_id": 0}):
        return True
    if await db.party_match_queue.find_one({"user_ids": {"$in": user_ids}}, {"_id": 0}):
        return True
    return False


async def _create_room(*, caller_id: str, user_a: str, extra_a: list, user_b: str, extra_b: list, opposition: float, topics: list) -> str:
    room_id = f"room_{uuid.uuid4().hex[:12]}"
    founding = [user_a, *extra_a, user_b, *extra_b]
    await db.rooms.insert_one({
        "room_id": room_id,
        "user_a": user_a, "extra_a": extra_a,
        "user_b": user_b, "extra_b": extra_b,
        "founding_members": founding,
        "opposition_score": opposition,
        "topics": topics,
        "categories": ["Politics"],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "status": "active",
    })
    # The caller gets the match synchronously in this response and never
    # polls — only every OTHER founding member needs a "pending_room" record
    # to pick up on their next /match/poll.
    now = datetime.now(timezone.utc).isoformat()
    for uid in founding:
        if uid == caller_id:
            continue
        await db.pending_rooms.update_one(
            {"user_id": uid}, {"$set": {"user_id": uid, "room_id": room_id, "created_at": now}}, upsert=True
        )
    return room_id


@router.post("/match/enqueue")
async def enqueue(user: User = Depends(get_current_user)):
    if not user.onboarded:
        raise HTTPException(status_code=400, detail="Complete onboarding first")
    if not user.id_verified:
        raise HTTPException(status_code=400, detail="ID verification required")

    my_stance = StanceScores(**user.stance.model_dump())

    # Look for the best opposition already in the solo queue
    candidates = await db.match_queue.find({"user_id": {"$ne": user.user_id}}, {"_id": 0}).to_list(50)
    best = None
    best_score = -1.0
    for c in candidates:
        score = opposition_score(my_stance, StanceScores(**c["stance"]))
        if score > best_score:
            best_score, best = score, c

    if best:
        topics = await generate_topics(user.stance, StanceScores(**best["stance"]))
        room_id = await _create_room(
            caller_id=user.user_id,
            user_a=user.user_id, extra_a=[], user_b=best["user_id"], extra_b=[],
            opposition=best_score, topics=topics,
        )
        await db.match_queue.delete_one({"user_id": best["user_id"]})
        return {"matched": True, "room_id": room_id, "opposition_score": best_score, "topics": topics}

    # No solo candidate — see if a party is waiting for exactly this: a single
    # opponent (client brief #13: "matched against a party-of-2 if available,
    # else matched down to a single opponent" applies symmetrically either
    # direction reaches the queues in).
    parties = await db.party_match_queue.find({}, {"_id": 0}).to_list(50)
    best_party, best_party_score = None, -1.0
    for p in parties:
        score = opposition_score(my_stance, StanceScores(**p["stance_avg"]))
        if score > best_party_score:
            best_party_score, best_party = score, p

    if best_party:
        opponents = best_party["user_ids"]
        topics = await generate_topics(user.stance, StanceScores(**best_party["stance_avg"]))
        room_id = await _create_room(
            caller_id=user.user_id,
            user_a=user.user_id, extra_a=[], user_b=opponents[0], extra_b=opponents[1:],
            opposition=best_party_score, topics=topics,
        )
        await db.party_match_queue.delete_one({"party_id": best_party["party_id"]})
        return {"matched": True, "room_id": room_id, "opposition_score": best_party_score, "topics": topics}

    # Nobody available — enqueue self
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


@router.post("/match/enqueue-party")
async def enqueue_party(payload: PartyEnqueueRequest, user: User = Depends(get_current_user)):
    """Two friends queue together (client brief #13's other group-debate
    mechanism). Matched against a waiting opposing party first, else against
    a single opponent already in the solo queue, else this party waits."""
    if not user.onboarded or not user.id_verified:
        raise HTTPException(status_code=400, detail="Complete onboarding + verification first")
    friend_id = payload.friend_id
    if friend_id == user.user_id:
        raise HTTPException(status_code=400, detail="Pick a different friend to party with")

    friendship = await db.friendships.find_one(
        {"status": "accepted", "$or": [{"user_a": user.user_id, "user_b": friend_id}, {"user_a": friend_id, "user_b": user.user_id}]},
        {"_id": 0},
    )
    if not friendship:
        raise HTTPException(status_code=400, detail="You can only party-queue with an accepted friend")
    friend = await db.users.find_one({"user_id": friend_id}, {"_id": 0})
    if not friend or not friend.get("onboarded") or not friend.get("id_verified") or not friend.get("stance"):
        raise HTTPException(status_code=400, detail="Your friend needs to finish onboarding + verification first")

    my_party = [user.user_id, friend_id]
    if await _already_queued(my_party):
        raise HTTPException(status_code=400, detail="You or your friend are already queued somewhere")

    my_avg = _avg_stance([StanceScores(**user.stance.model_dump()), StanceScores(**friend["stance"])])

    # 1) an opposing party already waiting?
    parties = await db.party_match_queue.find({}, {"_id": 0}).to_list(50)
    best_party, best_party_score = None, -1.0
    for p in parties:
        if set(p["user_ids"]) & set(my_party):
            continue
        score = opposition_score(my_avg, StanceScores(**p["stance_avg"]))
        if score > best_party_score:
            best_party_score, best_party = score, p

    if best_party:
        opponents = best_party["user_ids"]
        topics = await generate_topics(my_avg, StanceScores(**best_party["stance_avg"]))
        room_id = await _create_room(
            caller_id=user.user_id,
            user_a=user.user_id, extra_a=[friend_id], user_b=opponents[0], extra_b=opponents[1:],
            opposition=best_party_score, topics=topics,
        )
        await db.party_match_queue.delete_one({"party_id": best_party["party_id"]})
        return {"matched": True, "room_id": room_id, "opposition_score": best_party_score, "topics": topics}

    # 2) a single opponent already waiting in the solo queue?
    solos = await db.match_queue.find({"user_id": {"$nin": my_party}}, {"_id": 0}).to_list(50)
    best_solo, best_solo_score = None, -1.0
    for c in solos:
        score = opposition_score(my_avg, StanceScores(**c["stance"]))
        if score > best_solo_score:
            best_solo_score, best_solo = score, c

    if best_solo:
        topics = await generate_topics(my_avg, StanceScores(**best_solo["stance"]))
        room_id = await _create_room(
            caller_id=user.user_id,
            user_a=user.user_id, extra_a=[friend_id], user_b=best_solo["user_id"], extra_b=[],
            opposition=best_solo_score, topics=topics,
        )
        await db.match_queue.delete_one({"user_id": best_solo["user_id"]})
        return {"matched": True, "room_id": room_id, "opposition_score": best_solo_score, "topics": topics}

    # 3) nobody available — enqueue the party
    await db.party_match_queue.insert_one({
        "party_id": f"party_{uuid.uuid4().hex[:12]}",
        "user_ids": my_party,
        "stance_avg": my_avg.model_dump(),
        "joined_at": datetime.now(timezone.utc).isoformat(),
    })
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
    await db.party_match_queue.delete_one({"user_ids": user.user_id})
    return {"ok": True}
