"""Marketing/social draft tooling — admin-only (deps.require_admin), its
own router since "help the admin post to Instagram" is a distinct surface
from user management (admin.py) or trust & safety (reports.py, verify.py).

Deliberately draft-only: this picks a debate and writes copy for a human
to review and post by hand. It does NOT call any social platform's API —
that's blocked on the user setting up a real Meta Business Manager +
Instagram Professional account + Developer App (see the plan this came
from). Once that exists, a posting endpoint can reuse exactly the
selection + caption logic here.
"""
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends

from ..db import db
from ..deps import require_admin
from ..llm import generate_social_caption
from ..models import User
from ..room_utils import side_members

router = APIRouter()


def _debater_label(room: dict, docs: dict, side: str) -> str:
    uid = room.get(f"user_{side}")
    if not uid:
        return "Open seat"
    doc = docs.get(uid) or {}
    return doc.get("display_name") or doc.get("name") or "A debater"


async def _pick_candidate(since_iso: Optional[str]) -> Optional[dict]:
    query: dict = {
        "status": "ended",
        "$or": [{"is_public": True}, {"archive_visibility": {"$in": ["public", "unlisted"]}}],
    }
    if since_iso:
        query["$and"] = [{"$or": [{"published_at": {"$gte": since_iso}}, {"created_at": {"$gte": since_iso}}]}]
    rooms = await db.rooms.find(query, {"_id": 0}).to_list(200)
    if not rooms:
        return None

    room_ids = [r["room_id"] for r in rooms]
    vote_counts = {}
    async for v in db.debate_votes.aggregate([
        {"$match": {"room_id": {"$in": room_ids}}},
        {"$group": {"_id": "$room_id", "n": {"$sum": 1}}},
    ]):
        vote_counts[v["_id"]] = v["n"]

    def score(r):
        return int(r.get("likes", 0)) + vote_counts.get(r["room_id"], 0) * 2  # a cast vote is a stronger signal than a like

    rooms.sort(key=score, reverse=True)
    best = rooms[0]
    if score(best) <= 0:
        return None  # nothing with any real engagement — don't manufacture a "best" out of silence
    return best


@router.get("/admin/social/draft-of-the-week")
async def draft_of_the_week(_admin: User = Depends(require_admin)):
    """Picks the most-engaged public, ended debate from the last 7 days
    (falls back to "ever" if nothing qualifies in that window — this app
    has very little real content yet, so an empty week shouldn't mean an
    empty draft tool) and writes an Instagram-ready caption for it."""
    since = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    room = await _pick_candidate(since) or await _pick_candidate(None)
    if not room:
        return {"available": False, "reason": "No public debate with any likes or votes exists yet."}

    member_ids = side_members(room, "a") + side_members(room, "b")
    docs = {d["user_id"]: d async for d in db.users.find({"user_id": {"$in": member_ids}}, {"_id": 0})}
    side_a = _debater_label(room, docs, "a")
    side_b = _debater_label(room, docs, "b")
    vote_a = await db.debate_votes.count_documents({"room_id": room["room_id"], "side": "a"})
    vote_b = await db.debate_votes.count_documents({"room_id": room["room_id"], "side": "b"})

    title = room.get("custom_title") or (room.get("topics") or [None])[0] or (
        f"{room['categories'][0]} debate" if room.get("categories") else "Untitled debate"
    )

    ai = await generate_social_caption({
        "title": title,
        "category": (room.get("categories") or [None])[0],
        "side_a": side_a,
        "side_b": side_b,
        "likes": room.get("likes", 0),
        "spectator_count": 0,
        "votes_a": vote_a,
        "votes_b": vote_b,
    })
    is_fallback = ai is None
    caption = ai["caption"] if ai else f'"{title}" — {side_a} vs {side_b}. Watch the full debate on indifferent.'
    hashtags = ai["hashtags"] if ai else ["debate", "indifferent", "changemymind"]

    return {
        "available": True,
        "room_id": room["room_id"],
        "title": title,
        "thumbnail_url": room.get("thumbnail_url"),
        "side_a": side_a,
        "side_b": side_b,
        "likes": room.get("likes", 0),
        "votes_a": vote_a,
        "votes_b": vote_b,
        "caption": caption,
        "hashtags": hashtags,
        "is_fallback_caption": is_fallback,
        "watch_url": f"/watch/{room['room_id']}",
    }
