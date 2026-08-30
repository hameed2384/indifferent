import re
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from ..db import db
from ..deps import get_current_user, get_current_user_optional, require_xhr
from ..llm import analyze_vote_reasoning
from ..models import User
from ..reactions import react_once
from ..room_utils import MAX_PER_SIDE, is_participant, member_side, side_members
from ..topic_stances import upsert_topic_stance

router = APIRouter()


async def _spectator_count(room_id: str) -> int:
    """Docs in spectator_heartbeats are TTL'd out ~45s after a client stops
    polling (see db.create_indexes), so a plain count approximates "currently
    watching" without needing a persistent connection to track presence."""
    return await db.spectator_heartbeats.count_documents({"room_id": room_id})


async def _touch_heartbeat(room_id: str, client_id: Optional[str]):
    if not client_id:
        return
    await db.spectator_heartbeats.update_one(
        {"room_id": room_id, "client_id": client_id},
        {"$set": {"last_seen_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )


def _side(doc: Optional[dict], user_id: Optional[str], fallback_label: str) -> dict:
    """Build a side_a/side_b summary. user_id is None for a go-live room's
    still-open seat — the client tells "waiting for an opponent" apart from
    a real, resolvable debater this way rather than a fake identity string."""
    if not user_id or not doc:
        return {"identity": None, "display_name": fallback_label, "stance": None, "id_verified": False, "open": not user_id}
    return {
        "identity": f"user-{user_id}",
        "display_name": doc.get("display_name") or doc.get("name") or fallback_label,
        "stance": doc.get("stance"),
        "id_verified": doc.get("id_verified", False),
        "open": False,
    }


async def _participant_docs(room: dict) -> dict:
    """user_id -> user doc, for every member of the room (primaries + extras)."""
    docs = {}
    for uid in side_members(room, "a") + side_members(room, "b"):
        docs[uid] = await db.users.find_one({"user_id": uid}, {"_id": 0}) or {}
    return docs


def _extra_sides(room: dict, docs: dict, side: str) -> list:
    """Party partners / approved joiners beyond the primary user_a/user_b —
    same shape as _side() so the frontend renders them identically."""
    primary = room.get(f"user_{side}")
    return [_side(docs.get(uid), uid, "Debater") for uid in side_members(room, side) if uid != primary]


@router.post("/rooms/{room_id}/publish")
async def toggle_publish(room_id: str, user: User = Depends(get_current_user), _xhr: None = Depends(require_xhr)):
    """Either ORIGINAL debater flips their consent — party partners and any
    subscriber who joined later don't get a vote on publishing, same as they
    don't get a vote on kicking (client brief #13). Room goes public when
    both original debaters have consented."""
    room = await db.rooms.find_one({"room_id": room_id}, {"_id": 0})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    if user.user_id not in (room["user_a"], room.get("user_b")):
        raise HTTPException(status_code=403, detail="Only the original two debaters control publishing")
    if not room.get("user_b"):
        # A solo go-live room is public unconditionally (that's the entire
        # point of "Go Live") — there's no second participant to co-consent
        # with, so the mutual-consent toggle below doesn't apply here. Making
        # this a no-op (rather than letting it fall through) specifically
        # prevents it from computing a false "both consented" state and
        # accidentally un-publishing an already-public solo room.
        return {"publish_a": True, "publish_b": False, "is_public": True}

    field = "publish_a" if room["user_a"] == user.user_id else "publish_b"
    new_val = not bool(room.get(field, False))
    other_field = "publish_b" if field == "publish_a" else "publish_a"
    was_public = bool(room.get("is_public", False))
    updates = {field: new_val}
    updates["is_public"] = bool(new_val and room.get(other_field, False))
    if updates["is_public"] and not room.get("published_at"):
        updates["published_at"] = datetime.now(timezone.utc).isoformat()
    if was_public and not updates["is_public"]:
        # Unpublished — clear published_at so a later republish doesn't sort by the
        # original publish time, and so a privately-toggled room never leaks a stale
        # timestamp to anything that reads it directly off the room doc.
        updates["published_at"] = None
    await db.rooms.update_one({"room_id": room_id}, {"$set": updates})
    # No spectator eviction step needed here (unlike the old WS version) — a
    # room that's gone private simply 404s spectators' next poll.

    return {"publish_a": updates.get("publish_a", room.get("publish_a", False)),
            "publish_b": updates.get("publish_b", room.get("publish_b", False)),
            "is_public": updates["is_public"]}


@router.get("/public/debates")
async def list_public_debates(category: Optional[str] = None, q: Optional[str] = None):
    """Live public rooms + ended rooms archived as public (client brief #16, #21-24).
    `category` filters to rooms tagged with that exact category; `q` searches
    topics/category text (title/description equivalents — rooms don't have a
    separate user-authored title, the Gemini-generated topics serve that role)."""
    query: dict = {"$or": [
        {"is_public": True, "status": "active"},
        {"archive_visibility": "public"},
    ]}
    if category:
        query = {"$and": [query, {"categories": category}]}
    if q:
        # re.escape: q is user-supplied free text, not regex syntax — without
        # this, a caller can hand Mongo their own regex metacharacters
        # (nested quantifiers etc.) and force pathological, expensive
        # matching server-side.
        pattern = re.escape(q.strip()[:200])
        query = {"$and": [query, {"$or": [
            {"topics": {"$regex": pattern, "$options": "i"}},
            {"categories": {"$regex": pattern, "$options": "i"}},
        ]}]}

    rooms = await db.rooms.find(query, {"_id": 0}).sort("published_at", -1).to_list(50)
    out = []
    for r in rooms:
        docs = await _participant_docs(r)
        out.append({
            "room_id": r["room_id"],
            "status": r.get("status", "active"),
            "opposition_score": r.get("opposition_score"),
            "topics": r.get("topics", []),
            "categories": r.get("categories", []),
            "likes": int(r.get("likes", 0)),
            "spectator_count": await _spectator_count(r["room_id"]),
            "published_at": r.get("published_at"),
            "archive_visibility": r.get("archive_visibility"),
            "side_a": _side(docs.get(r["user_a"]), r["user_a"], "Debater A"),
            "side_b": _side(docs.get(r.get("user_b")), r.get("user_b"), "Open seat — request to join"),
            "side_a_extra": _extra_sides(r, docs, "a"),
            "side_b_extra": _extra_sides(r, docs, "b"),
        })
    return {"debates": out}


@router.get("/public/debates/{room_id}")
async def get_public_debate(room_id: str, viewer: Optional[User] = Depends(get_current_user_optional)):
    """Public listing shows only archive_visibility == "public"; this direct-link
    lookup also accepts "unlisted" (YouTube unlisted-video model, client brief #16)
    and any currently-live is_public room."""
    r = await db.rooms.find_one({"room_id": room_id, "$or": [
        {"is_public": True},
        {"archive_visibility": {"$in": ["public", "unlisted"]}},
    ]}, {"_id": 0})
    if not r:
        raise HTTPException(status_code=404, detail="Debate not public or not found")
    docs = await _participant_docs(r)
    my_vote = None
    if viewer:
        mv = await db.debate_votes.find_one({"room_id": room_id, "user_id": viewer.user_id}, {"_id": 0})
        my_vote = mv["side"] if mv else None
    msgs = await db.chat_messages.find({"room_id": room_id}, {"_id": 0}).sort("created_at", 1).to_list(200)
    for m in msgs:
        side = member_side(r, m["sender_id"]) or "b"
        speaker_doc = docs.get(m["sender_id"], {})
        m["speaker"] = speaker_doc.get("display_name") or speaker_doc.get("name") or "Debater"
        m["speaker_side"] = side
        m.pop("sender_id", None)
    comments = await db.spectator_comments.find({"room_id": room_id}, {"_id": 0}).sort("created_at", -1).to_list(50)
    tally = await _vote_tally(room_id)
    return {
        "room_id": room_id,
        "status": r.get("status", "active"),
        "opposition_score": r.get("opposition_score"),
        "topics": r.get("topics", []),
        "categories": r.get("categories", []),
        "likes": int(r.get("likes", 0)),
        "dislikes": int(r.get("dislikes", 0)),
        **tally,
        "my_vote": my_vote,
        "spectator_count": await _spectator_count(room_id),
        "published_at": r.get("published_at"),
        "archive_visibility": r.get("archive_visibility"),
        "side_a": _side(docs.get(r["user_a"]), r["user_a"], "Debater A"),
        "side_b": _side(docs.get(r.get("user_b")), r.get("user_b"), "Open seat — request to join"),
        "side_a_extra": _extra_sides(r, docs, "a"),
        "side_b_extra": _extra_sides(r, docs, "b"),
        "side_full": {s: len(side_members(r, s)) >= MAX_PER_SIDE for s in ("a", "b")},
        "chat": msgs,
        "comments": comments,
        "server_time": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/public/debates/{room_id}/updates")
async def poll_public_updates(room_id: str, since: Optional[str] = None, client_id: Optional[str] = None):
    """Poll for spectator-side activity since a given ISO timestamp (pass back
    the response's server_time as the next `since`). Replaces the old WS
    'debate-chat' mirror / 'comment' / 'like' / 'spectator-count' pushes.
    Also doubles as this spectator's presence heartbeat when client_id is
    given — no separate endpoint needed for that.

    Visibility check must match get_public_debate()'s exactly (is_public OR
    archived public/unlisted) — this used to only match is_public, which
    404'd every single poll for an ended/archived debate a few seconds after
    the initial (correctly permissive) fetch had already loaded it, and the
    frontend treats a 404 here as "the debate ended, go back" — silently
    kicking anyone watching a recording back to the feed within ~3 seconds
    of opening it."""
    r = await db.rooms.find_one({"room_id": room_id, "$or": [
        {"is_public": True},
        {"archive_visibility": {"$in": ["public", "unlisted"]}},
    ]}, {"_id": 0})
    if not r:
        raise HTTPException(status_code=404, detail="Debate not public or not found")
    await _touch_heartbeat(room_id, client_id)

    docs = await _participant_docs(r)

    chat_filter = {"room_id": room_id}
    comment_filter = {"room_id": room_id}
    if since:
        chat_filter["created_at"] = {"$gt": since}
        comment_filter["created_at"] = {"$gt": since}
    msgs = await db.chat_messages.find(chat_filter, {"_id": 0}).sort("created_at", 1).to_list(200)
    chat_events = []
    for m in msgs:
        speaker_doc = docs.get(m["sender_id"], {})
        chat_events.append({
            "type": "debate-chat",
            "speaker": speaker_doc.get("display_name") or speaker_doc.get("name") or "Debater",
            "speaker_side": member_side(r, m["sender_id"]) or "b",
            "text": m["text"],
            "ts": m["created_at"],
        })
    comments = await db.spectator_comments.find(comment_filter, {"_id": 0}).sort("created_at", 1).to_list(50)
    comment_events = [{"type": "comment", "text": c["text"], "author": c["author"], "authed": c["authed"], "ts": c["created_at"]} for c in comments]

    events = sorted(chat_events + comment_events, key=lambda e: e["ts"])

    tally = await _vote_tally(room_id)
    return {
        "events": events,
        "categories": r.get("categories", []),
        "is_public": bool(r.get("is_public", False)),
        "likes": int(r.get("likes", 0)),
        "dislikes": int(r.get("dislikes", 0)),
        **tally,
        "spectator_count": await _spectator_count(room_id),
        "server_time": datetime.now(timezone.utc).isoformat(),
    }


class SpectatorCommentIn(BaseModel):
    text: str


@router.post("/public/debates/{room_id}/comment")
async def post_comment(room_id: str, payload: SpectatorCommentIn, user: Optional[User] = Depends(get_current_user_optional)):
    r = await db.rooms.find_one({"room_id": room_id, "is_public": True}, {"_id": 0})
    if not r:
        raise HTTPException(status_code=404, detail="Debate not public or not found")
    text = payload.text.strip()[:280]
    if not text:
        raise HTTPException(status_code=400, detail="Empty comment")
    display_name = (user.display_name or user.name) if user else None
    now = datetime.now(timezone.utc).isoformat()
    await db.spectator_comments.insert_one({
        "room_id": room_id, "text": text,
        "author": display_name or "anonymous", "authed": bool(display_name),
        "created_at": now,
    })
    return {"ok": True, "ts": now}


@router.post("/public/debates/{room_id}/like")
async def like_debate(room_id: str, user: User = Depends(get_current_user)):
    r = await db.rooms.find_one({"room_id": room_id, "is_public": True}, {"_id": 0})
    if not r:
        raise HTTPException(status_code=404, detail="Not found")
    if await react_once(db.room_reactions, "room_id", room_id, user.user_id, "like"):
        await db.rooms.update_one({"room_id": room_id}, {"$inc": {"likes": 1}})
    fresh = await db.rooms.find_one({"room_id": room_id}, {"_id": 0})
    return {"likes": int(fresh.get("likes", 0))}


@router.post("/public/debates/{room_id}/dislike")
async def dislike_debate(room_id: str, user: User = Depends(get_current_user)):
    r = await db.rooms.find_one({"room_id": room_id, "is_public": True}, {"_id": 0})
    if not r:
        raise HTTPException(status_code=404, detail="Not found")
    if await react_once(db.room_reactions, "room_id", room_id, user.user_id, "dislike"):
        await db.rooms.update_one({"room_id": room_id}, {"$inc": {"dislikes": 1}})
    fresh = await db.rooms.find_one({"room_id": room_id}, {"_id": 0})
    return {"dislikes": int(fresh.get("dislikes", 0))}


class VoteIn(BaseModel):
    side: str  # "a" | "b"
    reasoning: Optional[str] = None


async def _vote_tally(room_id: str) -> dict:
    votes_a = await db.debate_votes.count_documents({"room_id": room_id, "side": "a"})
    votes_b = await db.debate_votes.count_documents({"room_id": room_id, "side": "b"})
    return {"votes_a": votes_a, "votes_b": votes_b}


@router.post("/public/debates/{room_id}/vote")
async def vote_on_debate(room_id: str, payload: VoteIn, user: User = Depends(get_current_user)):
    """Agree/disagree with reasoning (client brief #17/#18) — requires auth
    since, unlike a like or a comment, this refines the voter's OWN
    topic_stances position and can be changed later, not just tallied."""
    if payload.side not in ("a", "b"):
        raise HTTPException(status_code=400, detail="side must be 'a' or 'b'")
    r = await db.rooms.find_one({"room_id": room_id}, {"_id": 0})
    if not r or not (r.get("is_public") or r.get("archive_visibility") in ("public", "unlisted")):
        raise HTTPException(status_code=404, detail="Debate not public or not found")
    if not side_members(r, payload.side):
        # A solo go-live room can have a genuinely empty side (the open
        # seat) — agreeing with nobody produces a meaningless vote and
        # would still feed a fabricated signal into the voter's own
        # topic-stance profile below.
        raise HTTPException(status_code=400, detail="That side doesn't have a debater yet")

    now = datetime.now(timezone.utc).isoformat()
    reasoning = (payload.reasoning or "").strip()[:1000]
    await db.debate_votes.update_one(
        {"room_id": room_id, "user_id": user.user_id},
        {"$set": {"room_id": room_id, "user_id": user.user_id, "side": payload.side, "reasoning": reasoning, "created_at": now}},
        upsert=True,
    )

    docs = await _participant_docs(r)
    side_a_label = (docs.get(r["user_a"]) or {}).get("display_name") or "Side A"
    side_b_label = (docs.get(r.get("user_b")) or {}).get("display_name") or "Side B"
    topic = (r.get("categories") or ["General"])[0]
    ai = await analyze_vote_reasoning(topic, side_a_label, side_b_label, reasoning)
    if ai and ai.get("position") is not None:
        position = max(-10.0, min(10.0, float(ai["position"])))
        summary = str(ai.get("summary", ""))[:200]
        tags = [str(t)[:30] for t in (ai.get("tags") or [])][:4]
    else:
        # No reasoning text, or Gemini unavailable — still a real signal, just
        # a flatter one: picking a side without elaborating nudges moderately
        # rather than not updating the profile at all.
        position = -6.0 if payload.side == "a" else 6.0
        summary, tags = "", []
    for category in (r.get("categories") or ["General"]):
        await upsert_topic_stance(user.user_id, category, category, position, summary, tags, blend=True)

    tally = await _vote_tally(room_id)
    return {**tally, "my_vote": payload.side}
