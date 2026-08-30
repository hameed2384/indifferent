import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from pymongo import ReturnDocument

from ..categories import CATEGORIES
from ..db import db
from ..deps import get_current_user, require_xhr
from ..hubs import maybe_detect_topic_drift, maybe_run_coach
from ..models import (
    ArchiveVisibility,
    GoLiveRequest,
    JoinRequestCreate,
    JoinRequestDecision,
    KickVoteCreate,
    MatchFeedback,
    User,
)
from ..room_utils import (
    MAX_PER_SIDE,
    founding_members,
    is_founding,
    is_participant,
    member_side,
    side_members,
)

router = APIRouter()


def _require_participant(room: dict, user_id: str):
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    if not is_participant(room, user_id):
        raise HTTPException(status_code=403, detail="Not a participant")


def _require_founding(room: dict, user_id: str):
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    if not is_founding(room, user_id):
        raise HTTPException(status_code=403, detail="Only an original debater can do this")


@router.post("/rooms/golive")
async def go_live(payload: GoLiveRequest, user: User = Depends(get_current_user)):
    """On-demand broadcast: a debater picks a category and is immediately live
    and discoverable — no matchmaking, no scheduling (client brief: "a debater
    should not have to think 'this debate is scheduled for 8pm'"). Starts with
    only side A filled; side B is an open seat a subscriber can request to
    fill later (see #13 — join-request flow lands in a later phase). Reuses
    the exact same rooms/publish/chat/coach machinery as a matched room from
    that point on — a live-feed card doesn't know or care how its room started.
    """
    if not user.onboarded:
        raise HTTPException(status_code=400, detail="Complete onboarding first")
    if not user.id_verified:
        raise HTTPException(status_code=400, detail="ID verification required")
    if not user.is_debater:
        raise HTTPException(status_code=400, detail="Set your account as a debater first")
    if payload.category not in CATEGORIES:
        raise HTTPException(status_code=400, detail="Unknown category")

    room_id = f"room_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc).isoformat()
    await db.rooms.insert_one({
        "room_id": room_id,
        "user_a": user.user_id,
        "user_b": None,
        "extra_a": [],
        "extra_b": [],
        "founding_members": [user.user_id],
        "opposition_score": None,
        "topics": [],
        "categories": [payload.category],
        "created_at": now,
        "status": "active",
        # A solo go-live room is public the moment it's created — that's the
        # entire point (immediately discoverable), unlike a matched room where
        # both sides must separately opt in via /publish.
        "is_public": True,
        "published_at": now,
    })
    return {"room_id": room_id}


@router.get("/rooms/{room_id}")
async def get_room(room_id: str, user: User = Depends(get_current_user)):
    room = await db.rooms.find_one({"room_id": room_id}, {"_id": 0})
    _require_participant(room, user.user_id)
    my_side = member_side(room, user.user_id)
    founding = founding_members(room)

    participants = []
    for side in ("a", "b"):
        for uid in side_members(room, side):
            doc = await db.users.find_one({"user_id": uid}, {"_id": 0}) or {}
            participants.append({
                "user_id": uid,
                "display_name": doc.get("display_name") or doc.get("name") or "Debater",
                "stance": doc.get("stance"),
                "id_verified": doc.get("id_verified", False),
                "side": side,
                "is_self": uid == user.user_id,
                "is_founding": uid in founding,
                # Only the two ORIGINAL primaries control publishing (see
                # /rooms/{id}/publish) — party partners and approved joiners,
                # founding or not, don't get a vote on going public.
                "is_primary": uid == room.get(f"user_{side}"),
            })

    join_requests = []
    kick_votes = []
    if user.user_id in founding:
        join_requests = await db.room_join_requests.find({"room_id": room_id}, {"_id": 0}).to_list(20)
        kick_votes = await db.room_kick_votes.find({"room_id": room_id}, {"_id": 0}).to_list(20)

    return {
        "room_id": room_id,
        "opposition_score": room.get("opposition_score"),
        "topics": room.get("topics", []),
        "categories": room.get("categories", []),
        "participants": participants,
        "my_role": my_side,
        "is_founding": user.user_id in founding,
        "side_full": {s: len(side_members(room, s)) >= MAX_PER_SIDE for s in ("a", "b")},
        "join_requests": join_requests,
        "kick_votes": kick_votes,
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
    if room.get("user_b"):  # coach needs two sides' worth of A:/B: transcript to mean anything
        await maybe_run_coach(room_id, room)
    await maybe_detect_topic_drift(room_id, room)
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
        "categories": room.get("categories", []),
        "is_public": bool(room.get("is_public", False)),
        "publish_a": bool(room.get("publish_a", False)),
        "publish_b": bool(room.get("publish_b", False)),
        "server_time": datetime.now(timezone.utc).isoformat(),
    }


@router.post("/rooms/{room_id}/feedback")
async def submit_feedback(room_id: str, fb: MatchFeedback, user: User = Depends(get_current_user)):
    room = await db.rooms.find_one({"room_id": room_id}, {"_id": 0})
    _require_participant(room, user.user_id)
    rating = max(1, min(5, fb.rating))
    notes = (fb.notes or "")[:1000]
    await db.feedback.insert_one({
        "room_id": room_id,
        "user_id": user.user_id,
        "rating": rating,
        "mind_changed": fb.mind_changed,
        "notes": notes,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    inc = {"debates": 1}
    if fb.mind_changed:
        inc["minds_changed"] = 1
    await db.users.update_one({"user_id": user.user_id}, {"$inc": inc})
    await db.rooms.update_one({"room_id": room_id}, {"$set": {"status": "ended"}})
    return {"ok": True}


@router.post("/rooms/{room_id}/archive-visibility")
async def set_archive_visibility(room_id: str, payload: ArchiveVisibility, user: User = Depends(get_current_user)):
    """Once a debate has ended, either participant can choose how the archived
    record is exposed: public (shows in the feed/search), unlisted (works via
    direct link, not listed), or private (participants only) — the YouTube
    unlisted-video model, per client brief #16."""
    if payload.visibility not in ("private", "unlisted", "public"):
        raise HTTPException(status_code=400, detail="visibility must be private, unlisted, or public")
    room = await db.rooms.find_one({"room_id": room_id}, {"_id": 0})
    _require_participant(room, user.user_id)
    if room.get("status") != "ended":
        raise HTTPException(status_code=400, detail="Debate must have ended first")
    await db.rooms.update_one({"room_id": room_id}, {"$set": {"archive_visibility": payload.visibility}})
    return {"archive_visibility": payload.visibility}


@router.post("/rooms/{room_id}/join-requests")
async def request_to_join(room_id: str, payload: JoinRequestCreate, user: User = Depends(get_current_user)):
    """A subscriber asks to join a live debate as a third (or fourth) voice.
    Requires being subscribed to at least one founding debater on the room —
    that's the whole premise of "a subscriber requests to join" (client brief
    #13). Needs unanimous approval from every founding member before the
    requester actually becomes a participant (see the /decide endpoint)."""
    if payload.side not in ("a", "b"):
        raise HTTPException(status_code=400, detail="side must be 'a' or 'b'")
    room = await db.rooms.find_one({"room_id": room_id}, {"_id": 0})
    if not room or room.get("status") != "active" or not room.get("is_public"):
        raise HTTPException(status_code=404, detail="Debate not live")
    if is_participant(room, user.user_id):
        raise HTTPException(status_code=400, detail="You're already in this debate")
    if len(side_members(room, payload.side)) >= MAX_PER_SIDE:
        raise HTTPException(status_code=400, detail="That side is already full")

    founding = founding_members(room)
    sub = await db.subscriptions_debater.find_one(
        {"subscriber_id": user.user_id, "debater_id": {"$in": founding}, "active": True}, {"_id": 0}
    )
    if not sub:
        raise HTTPException(status_code=403, detail="Subscribe to a debater in this debate to request joining")

    existing = await db.room_join_requests.find_one({"room_id": room_id, "user_id": user.user_id}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="You already have a pending request for this debate")

    now = datetime.now(timezone.utc).isoformat()
    await db.room_join_requests.insert_one({
        "room_id": room_id, "user_id": user.user_id,
        "display_name": user.display_name or user.name,
        "side": payload.side, "approvals": [], "created_at": now,
    })
    return {"status": "pending"}


@router.get("/rooms/{room_id}/join-status")
async def my_join_status(room_id: str, user: User = Depends(get_current_user)):
    """Polled by a spectator who's requested to join — tells them when they've
    been let in (at which point /room/{id} has them as a real participant) or
    turned down (any single founding member declining ends the request)."""
    room = await db.rooms.find_one({"room_id": room_id}, {"_id": 0})
    if room and is_participant(room, user.user_id):
        return {"status": "approved"}
    pending = await db.room_join_requests.find_one({"room_id": room_id, "user_id": user.user_id}, {"_id": 0})
    return {"status": "pending" if pending else "none"}


@router.post("/rooms/{room_id}/join-requests/{requester_id}/decide")
async def decide_join_request(room_id: str, requester_id: str, payload: JoinRequestDecision, user: User = Depends(get_current_user)):
    room = await db.rooms.find_one({"room_id": room_id}, {"_id": 0})
    _require_founding(room, user.user_id)
    req = await db.room_join_requests.find_one({"room_id": room_id, "user_id": requester_id}, {"_id": 0})
    if not req:
        raise HTTPException(status_code=404, detail="No pending request")

    if not payload.approve:
        await db.room_join_requests.delete_one({"room_id": room_id, "user_id": requester_id})
        return {"status": "rejected"}

    # $addToSet on find_one_and_update is a single atomic document op — unlike
    # read-array/append-in-Python/$set-whole-array, two founders approving
    # within the same instant can't clobber each other's vote (each request
    # returning the post-update doc means "approvals" always reflects every
    # write that's actually landed, not a stale Python-side snapshot).
    updated = await db.room_join_requests.find_one_and_update(
        {"room_id": room_id, "user_id": requester_id},
        {"$addToSet": {"approvals": user.user_id}},
        return_document=ReturnDocument.AFTER,
    )
    if not updated:
        raise HTTPException(status_code=404, detail="No pending request")
    approvals = updated.get("approvals", [])
    founding = founding_members(room)
    if not set(founding).issubset(approvals):
        return {"status": "pending", "approvals": approvals, "needed": founding}

    # Unanimous — seat them and clear the request. find_one_and_delete is the
    # atomic "am I the one who gets to seat them" gate: if two founders' final
    # votes both observe unanimity, only whichever one actually deletes the
    # request document proceeds past this point.
    deleted = await db.room_join_requests.find_one_and_delete({"room_id": room_id, "user_id": requester_id})
    if not deleted:
        return {"status": "approved"}
    side = req["side"]
    # The capacity check and the seat-add must be one atomic operation, not a
    # read-then-write — two different requesters approved to unanimity for
    # the same side within the same instant would otherwise both pass a
    # capacity check against a stale `room` snapshot and together overfill it.
    side_field, extra_field = f"user_{side}", f"extra_{side}"
    room_after = await db.rooms.find_one_and_update(
        {
            "room_id": room_id,
            "$expr": {"$lt": [
                {"$add": [
                    {"$cond": [{"$ifNull": [f"${side_field}", False]}, 1, 0]},
                    {"$size": {"$ifNull": [f"${extra_field}", []]}},
                ]},
                MAX_PER_SIDE,
            ]},
        },
        {"$addToSet": {extra_field: requester_id}},
        return_document=ReturnDocument.AFTER,
    )
    if not room_after:
        raise HTTPException(status_code=400, detail="That side filled up while this request was pending")
    return {"status": "approved"}


@router.post("/rooms/{room_id}/kick-votes")
async def cast_kick_vote(room_id: str, payload: KickVoteCreate, user: User = Depends(get_current_user)):
    """Removal requires a unanimous vote of the room's ORIGINAL/founding
    debaters only — a subscriber who joined later has no say in kicking
    anyone, and can't be the one others rally to keep (client brief #13)."""
    room = await db.rooms.find_one({"room_id": room_id}, {"_id": 0})
    _require_founding(room, user.user_id)
    founding = founding_members(room)
    if payload.target_user_id in founding or not is_participant(room, payload.target_user_id):
        raise HTTPException(status_code=400, detail="Target must be a non-founding participant")

    # $addToSet, not read-array/append/$set-whole-array — see the identical
    # reasoning on join-request approvals above; this was the same
    # lost-update shape (two founders voting within the same instant could
    # clobber each other's vote and a unanimous kick would never complete).
    updated = await db.room_kick_votes.find_one_and_update(
        {"room_id": room_id, "target_user_id": payload.target_user_id},
        {
            "$addToSet": {"votes": user.user_id},
            "$setOnInsert": {"created_at": datetime.now(timezone.utc).isoformat()},
        },
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )
    votes = updated.get("votes", [])

    if not set(founding).issubset(votes):
        return {"status": "pending", "votes": votes, "needed": founding}

    # Unanimous — only whichever concurrent request actually deletes the vote
    # doc proceeds to kick (same atomic single-actor gate as join-requests).
    deleted = await db.room_kick_votes.find_one_and_delete({"room_id": room_id, "target_user_id": payload.target_user_id})
    if not deleted:
        return {"status": "kicked"}
    side = member_side(room, payload.target_user_id)
    await db.rooms.update_one({"room_id": room_id}, {"$pull": {f"extra_{side}": payload.target_user_id}})
    return {"status": "kicked"}


@router.delete("/rooms/{room_id}/kick-votes/{target_user_id}")
async def retract_kick_vote(room_id: str, target_user_id: str, user: User = Depends(get_current_user), _xhr: None = Depends(require_xhr)):
    await db.room_kick_votes.update_one(
        {"room_id": room_id, "target_user_id": target_user_id}, {"$pull": {"votes": user.user_id}}
    )
    return {"status": "ok"}


@router.get("/dashboard/stats")
async def dashboard_stats(user: User = Depends(get_current_user)):
    recent = await db.feedback.find({"user_id": user.user_id}, {"_id": 0}).sort("created_at", -1).to_list(10)
    return {
        "debates": user.debates,
        "minds_changed": user.minds_changed,
        "stance": user.stance.model_dump() if user.stance else None,
        "recent_feedback": recent,
    }
