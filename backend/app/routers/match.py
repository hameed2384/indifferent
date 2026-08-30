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

    # Look for the best opposition already in the solo queue. Candidates are
    # claimed atomically (find_one_and_delete) in best-first order, *before*
    # the slow generate_topics round-trip — not read-then-later-delete, which
    # left a wide window where two concurrent callers could both pick the
    # same candidate, both synchronously return "matched" with two different
    # rooms, and leave the candidate's own poll only ever pointing at one of
    # them (the other caller's room silently orphaned, no one ever told).
    candidates = await db.match_queue.find({"user_id": {"$ne": user.user_id}}, {"_id": 0}).to_list(50)
    ranked = sorted(candidates, key=lambda c: opposition_score(my_stance, StanceScores(**c["stance"])), reverse=True)
    claimed, claimed_score = None, None
    for c in ranked:
        doc = await db.match_queue.find_one_and_delete({"user_id": c["user_id"]})
        if doc:
            claimed, claimed_score = doc, opposition_score(my_stance, StanceScores(**doc["stance"]))
            break

    if claimed:
        topics = await generate_topics(user.stance, StanceScores(**claimed["stance"]))
        room_id = await _create_room(
            caller_id=user.user_id,
            user_a=user.user_id, extra_a=[], user_b=claimed["user_id"], extra_b=[],
            opposition=claimed_score, topics=topics,
        )
        return {"matched": True, "room_id": room_id, "opposition_score": claimed_score, "topics": topics}

    # No solo candidate — see if a party is waiting for exactly this: a single
    # opponent (client brief #13: "matched against a party-of-2 if available,
    # else matched down to a single opponent" applies symmetrically either
    # direction reaches the queues in). Same atomic-claim-before-generate_topics
    # reasoning as above.
    parties = await db.party_match_queue.find({}, {"_id": 0}).to_list(50)
    ranked_parties = sorted(parties, key=lambda p: opposition_score(my_stance, StanceScores(**p["stance_avg"])), reverse=True)
    claimed_party, claimed_party_score = None, None
    for p in ranked_parties:
        doc = await db.party_match_queue.find_one_and_delete({"party_id": p["party_id"]})
        if doc:
            claimed_party, claimed_party_score = doc, opposition_score(my_stance, StanceScores(**doc["stance_avg"]))
            break

    if claimed_party:
        opponents = claimed_party["user_ids"]
        topics = await generate_topics(user.stance, StanceScores(**claimed_party["stance_avg"]))
        room_id = await _create_room(
            caller_id=user.user_id,
            user_a=user.user_id, extra_a=[], user_b=opponents[0], extra_b=opponents[1:],
            opposition=claimed_party_score, topics=topics,
        )
        return {"matched": True, "room_id": room_id, "opposition_score": claimed_party_score, "topics": topics}

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

    # 1) an opposing party already waiting? Claim atomically (find_one_and_delete)
    # before generate_topics, same reasoning as enqueue() above — otherwise two
    # parties can each be matched against the same third party concurrently.
    parties = await db.party_match_queue.find({}, {"_id": 0}).to_list(50)
    eligible_parties = [p for p in parties if not (set(p["user_ids"]) & set(my_party))]
    ranked_parties = sorted(eligible_parties, key=lambda p: opposition_score(my_avg, StanceScores(**p["stance_avg"])), reverse=True)
    claimed_party, claimed_party_score = None, None
    for p in ranked_parties:
        doc = await db.party_match_queue.find_one_and_delete({"party_id": p["party_id"]})
        if doc:
            claimed_party, claimed_party_score = doc, opposition_score(my_avg, StanceScores(**doc["stance_avg"]))
            break

    if claimed_party:
        opponents = claimed_party["user_ids"]
        topics = await generate_topics(my_avg, StanceScores(**claimed_party["stance_avg"]))
        room_id = await _create_room(
            caller_id=user.user_id,
            user_a=user.user_id, extra_a=[friend_id], user_b=opponents[0], extra_b=opponents[1:],
            opposition=claimed_party_score, topics=topics,
        )
        return {"matched": True, "room_id": room_id, "opposition_score": claimed_party_score, "topics": topics}

    # 2) a single opponent already waiting in the solo queue? Same atomic claim.
    solos = await db.match_queue.find({"user_id": {"$nin": my_party}}, {"_id": 0}).to_list(50)
    ranked_solos = sorted(solos, key=lambda c: opposition_score(my_avg, StanceScores(**c["stance"])), reverse=True)
    claimed_solo, claimed_solo_score = None, None
    for c in ranked_solos:
        doc = await db.match_queue.find_one_and_delete({"user_id": c["user_id"]})
        if doc:
            claimed_solo, claimed_solo_score = doc, opposition_score(my_avg, StanceScores(**doc["stance"]))
            break

    if claimed_solo:
        topics = await generate_topics(my_avg, StanceScores(**claimed_solo["stance"]))
        room_id = await _create_room(
            caller_id=user.user_id,
            user_a=user.user_id, extra_a=[friend_id], user_b=claimed_solo["user_id"], extra_b=[],
            opposition=claimed_solo_score, topics=topics,
        )
        return {"matched": True, "room_id": room_id, "opposition_score": claimed_solo_score, "topics": topics}

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
