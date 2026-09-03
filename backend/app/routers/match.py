import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from ..db import db
from ..deps import get_current_user, require_xhr
from ..llm import generate_topics
from ..models import PartyEnqueueRequest, User
from ..topic_stances import get_tag_positions, shared_tag_opposition

router = APIRouter()


def _avg_tag_positions(members: list) -> dict:
    """Average position per tag across a party's tag_positions dicts, keeping
    only tags EVERY member actually has — a party can only advertise a tag
    into the queue if all of them share it, same "shared topic" requirement
    matching enforces everywhere else."""
    if not members:
        return {}
    common_tags = set(members[0])
    for m in members[1:]:
        common_tags &= set(m)
    n = len(members)
    return {
        tag: {"position": sum(m[tag]["position"] for m in members) / n, "summary": members[0][tag]["summary"]}
        for tag in common_tags
    }


async def _already_queued(user_ids: list) -> bool:
    if await db.match_queue.find_one({"user_id": {"$in": user_ids}}, {"_id": 0}):
        return True
    if await db.party_match_queue.find_one({"user_ids": {"$in": user_ids}}, {"_id": 0}):
        return True
    return False


async def _create_room(*, caller_id: str, user_a: str, extra_a: list, user_b: str, extra_b: list, opposition: float, topics: list, category: str) -> str:
    room_id = f"room_{uuid.uuid4().hex[:12]}"
    founding = [user_a, *extra_a, user_b, *extra_b]
    await db.rooms.insert_one({
        "room_id": room_id,
        "user_a": user_a, "extra_a": extra_a,
        "user_b": user_b, "extra_b": extra_b,
        "founding_members": founding,
        "opposition_score": opposition,
        "topics": topics,
        "categories": [category],
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
async def enqueue(user: User = Depends(get_current_user), _xhr: None = Depends(require_xhr)):
    if not user.onboarded:
        raise HTTPException(status_code=400, detail="Complete onboarding first")
    if not user.id_verified:
        raise HTTPException(status_code=400, detail="ID verification required")
    if not user.interest_tags:
        # onboarded and interest_tags are only ever set together, in the same
        # update_one call in onboarding.py's submit_onboarding — a real user
        # can't reach this through the app's own UI (including an already-
        # onboarded pre-redesign account: onboarded=True but interest_tags
        # empty, caught here with a clear message rather than however far
        # downstream a KeyError would otherwise surface).
        raise HTTPException(status_code=400, detail="Complete the updated onboarding to start matching")

    my_positions = await get_tag_positions(user.user_id, user.interest_tags)

    # Look for the best opposition already in the solo queue. Candidates are
    # claimed atomically (find_one_and_delete) in best-first order, *before*
    # the slow generate_topics round-trip — not read-then-later-delete, which
    # left a wide window where two concurrent callers could both pick the
    # same candidate, both synchronously return "matched" with two different
    # rooms, and leave the candidate's own poll only ever pointing at one of
    # them (the other caller's room silently orphaned, no one ever told).
    candidates = await db.match_queue.find({"user_id": {"$ne": user.user_id}}, {"_id": 0}).to_list(50)
    scored = [(c, shared_tag_opposition(my_positions, c["tag_positions"])) for c in candidates]
    ranked = sorted((s for s in scored if s[1] is not None), key=lambda s: s[1][1], reverse=True)
    claimed, claimed_tag, claimed_score = None, None, None
    for c, _ in ranked:
        doc = await db.match_queue.find_one_and_delete({"user_id": c["user_id"]})
        if doc:
            tag, score = shared_tag_opposition(my_positions, doc["tag_positions"])
            claimed, claimed_tag, claimed_score = doc, tag, score
            break

    if claimed:
        topics = await generate_topics(claimed_tag, my_positions[claimed_tag], claimed["tag_positions"][claimed_tag])
        room_id = await _create_room(
            caller_id=user.user_id,
            user_a=user.user_id, extra_a=[], user_b=claimed["user_id"], extra_b=[],
            opposition=claimed_score, topics=topics, category=claimed_tag,
        )
        return {"matched": True, "room_id": room_id, "opposition_score": claimed_score, "topics": topics, "category": claimed_tag}

    # No solo candidate — see if a party is waiting for exactly this: a single
    # opponent (client brief #13: "matched against a party-of-2 if available,
    # else matched down to a single opponent" applies symmetrically either
    # direction reaches the queues in). Same atomic-claim-before-generate_topics
    # reasoning as above.
    parties = await db.party_match_queue.find({}, {"_id": 0}).to_list(50)
    scored_parties = [(p, shared_tag_opposition(my_positions, p["tag_positions_avg"])) for p in parties]
    ranked_parties = sorted((s for s in scored_parties if s[1] is not None), key=lambda s: s[1][1], reverse=True)
    claimed_party, claimed_party_tag, claimed_party_score = None, None, None
    for p, _ in ranked_parties:
        doc = await db.party_match_queue.find_one_and_delete({"party_id": p["party_id"]})
        if doc:
            tag, score = shared_tag_opposition(my_positions, doc["tag_positions_avg"])
            claimed_party, claimed_party_tag, claimed_party_score = doc, tag, score
            break

    if claimed_party:
        opponents = claimed_party["user_ids"]
        topics = await generate_topics(claimed_party_tag, my_positions[claimed_party_tag], claimed_party["tag_positions_avg"][claimed_party_tag])
        room_id = await _create_room(
            caller_id=user.user_id,
            user_a=user.user_id, extra_a=[], user_b=opponents[0], extra_b=opponents[1:],
            opposition=claimed_party_score, topics=topics, category=claimed_party_tag,
        )
        return {"matched": True, "room_id": room_id, "opposition_score": claimed_party_score, "topics": topics, "category": claimed_party_tag}

    # Nobody available — enqueue self
    await db.match_queue.update_one(
        {"user_id": user.user_id},
        {"$set": {
            "user_id": user.user_id,
            "tag_positions": my_positions,
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
    if not user.onboarded or not user.id_verified or not user.interest_tags:
        raise HTTPException(status_code=400, detail="Complete the updated onboarding + verification first")
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
    if not friend or not friend.get("onboarded") or not friend.get("id_verified") or not friend.get("interest_tags"):
        raise HTTPException(status_code=400, detail="Your friend needs to finish the updated onboarding + verification first")

    my_party = [user.user_id, friend_id]
    if await _already_queued(my_party):
        raise HTTPException(status_code=400, detail="You or your friend are already queued somewhere")

    my_positions = await get_tag_positions(user.user_id, user.interest_tags)
    friend_positions = await get_tag_positions(friend_id, friend["interest_tags"])
    my_avg = _avg_tag_positions([my_positions, friend_positions])

    # 1) an opposing party already waiting? Claim atomically (find_one_and_delete)
    # before generate_topics, same reasoning as enqueue() above — otherwise two
    # parties can each be matched against the same third party concurrently.
    parties = await db.party_match_queue.find({}, {"_id": 0}).to_list(50)
    eligible_parties = [p for p in parties if not (set(p["user_ids"]) & set(my_party))]
    scored_parties = [(p, shared_tag_opposition(my_avg, p["tag_positions_avg"])) for p in eligible_parties]
    ranked_parties = sorted((s for s in scored_parties if s[1] is not None), key=lambda s: s[1][1], reverse=True)
    claimed_party, claimed_party_tag, claimed_party_score = None, None, None
    for p, _ in ranked_parties:
        doc = await db.party_match_queue.find_one_and_delete({"party_id": p["party_id"]})
        if doc:
            tag, score = shared_tag_opposition(my_avg, doc["tag_positions_avg"])
            claimed_party, claimed_party_tag, claimed_party_score = doc, tag, score
            break

    if claimed_party:
        opponents = claimed_party["user_ids"]
        topics = await generate_topics(claimed_party_tag, my_avg[claimed_party_tag], claimed_party["tag_positions_avg"][claimed_party_tag])
        room_id = await _create_room(
            caller_id=user.user_id,
            user_a=user.user_id, extra_a=[friend_id], user_b=opponents[0], extra_b=opponents[1:],
            opposition=claimed_party_score, topics=topics, category=claimed_party_tag,
        )
        return {"matched": True, "room_id": room_id, "opposition_score": claimed_party_score, "topics": topics, "category": claimed_party_tag}

    # 2) a single opponent already waiting in the solo queue? Same atomic claim.
    solos = await db.match_queue.find({"user_id": {"$nin": my_party}}, {"_id": 0}).to_list(50)
    scored_solos = [(c, shared_tag_opposition(my_avg, c["tag_positions"])) for c in solos]
    ranked_solos = sorted((s for s in scored_solos if s[1] is not None), key=lambda s: s[1][1], reverse=True)
    claimed_solo, claimed_solo_tag, claimed_solo_score = None, None, None
    for c, _ in ranked_solos:
        doc = await db.match_queue.find_one_and_delete({"user_id": c["user_id"]})
        if doc:
            tag, score = shared_tag_opposition(my_avg, doc["tag_positions"])
            claimed_solo, claimed_solo_tag, claimed_solo_score = doc, tag, score
            break

    if claimed_solo:
        topics = await generate_topics(claimed_solo_tag, my_avg[claimed_solo_tag], claimed_solo["tag_positions"][claimed_solo_tag])
        room_id = await _create_room(
            caller_id=user.user_id,
            user_a=user.user_id, extra_a=[friend_id], user_b=claimed_solo["user_id"], extra_b=[],
            opposition=claimed_solo_score, topics=topics, category=claimed_solo_tag,
        )
        return {"matched": True, "room_id": room_id, "opposition_score": claimed_solo_score, "topics": topics, "category": claimed_solo_tag}

    # 3) nobody available — enqueue the party
    await db.party_match_queue.insert_one({
        "party_id": f"party_{uuid.uuid4().hex[:12]}",
        "user_ids": my_party,
        "tag_positions_avg": my_avg,
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
async def cancel_match(user: User = Depends(get_current_user), _xhr: None = Depends(require_xhr)):
    await db.match_queue.delete_one({"user_id": user.user_id})
    await db.party_match_queue.delete_one({"user_ids": user.user_id})
    return {"ok": True}
