"""The Arena: anonymous one-tap votes on curated motions, played out as a game.

No sign-up, so a vote is tied to a random id kept in the visitor's browser. Only
a salted hash of it is stored, one vote per (motion, voter), and it can be
changed. This is a light poll for fun, not a verified count, and the page says
how many people voted rather than presenting it as a survey result.
"""
import hashlib
from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from ..db import db
from ..motions import MOTIONS_BY_ID, MOTIONS_BY_SLUG
from ..ratelimit import rate_limit

router = APIRouter()


class ArenaVote(BaseModel):
    side: Literal["for", "against"]
    voter_id: str = Field(pattern=r"^[A-Za-z0-9_-]{16,64}$")


def _motion(key: str) -> dict:
    motion = MOTIONS_BY_SLUG.get(key) or MOTIONS_BY_ID.get(key)
    if not motion:
        raise HTTPException(status_code=404, detail="Unknown debate")
    return motion


async def _tally(motion_id: str) -> dict:
    return {
        "votes_for": await db.arena_votes.count_documents({"motion_id": motion_id, "side": "for"}),
        "votes_against": await db.arena_votes.count_documents({"motion_id": motion_id, "side": "against"}),
    }


@router.get("/public/arena/{slug}")
async def arena_motion(slug: str):
    m = _motion(slug)
    return {"id": m["id"], "slug": m["slug"], "motion": m["motion"], "tag": m["tag"], **await _tally(m["id"])}


@router.post("/public/arena/{slug}/vote")
async def arena_vote(
    slug: str,
    payload: ArenaVote,
    _rl: None = Depends(rate_limit("arena_vote", limit=30, window_seconds=60)),
):
    m = _motion(slug)
    voter = hashlib.sha256(f"arena:{m['id']}:{payload.voter_id}".encode()).hexdigest()
    await db.arena_votes.update_one(
        {"motion_id": m["id"], "voter_hash": voter},
        {"$set": {"side": payload.side, "updated_at": datetime.now(timezone.utc)}},
        upsert=True,
    )
    return {**await _tally(m["id"]), "my_side": payload.side}
