"""Swipe: a never-ending stack of takes. Right = agree, left = disagree.

After every swipe the visitor sees how everyone else swiped. Their "position"
(type, how often they go against the crowd, topic by topic, rarest opinion)
is worked out in the browser from their own swipes plus these crowd numbers,
so nothing about the visitor is stored: only an anonymous agree/disagree
counter per take.

Takes = the curated debate motions plus the short hot takes from the
Instagram queue (app/swipe_takes.py).
"""
import time
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from pymongo import ReturnDocument

from ..db import db
from ..motions import MOTIONS
from ..ratelimit import rate_limit
from ..swipe_takes import SWIPE_TAKES

router = APIRouter()

CATALOG = [{"id": m["slug"], "text": m["motion"], "tag": m["tag"], "slug": m["slug"]} for m in MOTIONS] + \
          [{"id": t["id"], "text": t["text"], "tag": t["tag"]} for t in SWIPE_TAKES]
BY_ID = {t["id"]: t for t in CATALOG}
_cache = {"at": 0.0, "counts": {}}
CACHE_SECONDS = 60


class Vote(BaseModel):
    id: str = Field(max_length=120)
    v: Literal[1, -1]


async def _counts() -> dict:
    """{id: [agree, disagree]} for every take, refreshed at most once a minute."""
    if time.time() - _cache["at"] > CACHE_SECONDS:
        counts = {}
        async for d in db.swipe_votes.find({}, {"agree": 1, "disagree": 1}):
            counts[d["_id"]] = [d.get("agree", 0), d.get("disagree", 0)]
        _cache.update(at=time.time(), counts=counts)
    return _cache["counts"]


@router.get("/public/swipe/takes")
async def swipe_takes():
    counts = await _counts()
    return {"takes": [{**t, "votes": counts.get(t["id"], [0, 0])} for t in CATALOG]}


@router.post("/public/swipe/vote")
async def swipe_vote(
    payload: Vote,
    _rl: None = Depends(rate_limit("swipe_vote", limit=1500, window_seconds=3600)),
):
    if payload.id not in BY_ID:
        raise HTTPException(status_code=404, detail="Unknown take")
    field = "agree" if payload.v == 1 else "disagree"
    doc = await db.swipe_votes.find_one_and_update(
        {"_id": payload.id}, {"$inc": {field: 1}}, upsert=True, return_document=ReturnDocument.AFTER)
    return {"id": payload.id, "agree": doc.get("agree", 0), "disagree": doc.get("disagree", 0)}
