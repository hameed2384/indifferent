"""The Split Test: one person answers a set of takes, sends the link to friends,
and each friend sees exactly where the two of them split.

No sign-up. The creator gets a secret key (kept in their browser) that unlocks
everyone's answers; friends only see the creator's answers once they have
answered themselves, so nobody can copy them first. Names are display names
typed by the visitor, nothing else personal is stored.
"""
import hashlib
import re
import secrets
from datetime import datetime, timezone
from typing import Annotated, List, Literal, Union

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator

from ..db import db
from ..motions import MOTIONS_BY_SLUG
from ..ratelimit import rate_limit

router = APIRouter()

QUESTIONS = 12
MAX_RESPONSES = 100
# -2 strongly disagree .. 2 strongly agree. "for"/"against" were the first version's answers and still work.
Side = Union[Annotated[int, Field(strict=True, ge=-2, le=2)], Literal["for", "against"]]
_CODE_RE = re.compile(r"^[A-Za-z0-9_-]{6,16}$")


def _clean_name(value: str) -> str:
    value = re.sub(r"[\x00-\x1f\x7f<>]", "", value or "")
    value = " ".join(value.split())[:24]
    if not value:
        raise ValueError("name required")
    return value


class SplitCreate(BaseModel):
    name: str = Field(max_length=60)
    slugs: List[str] = Field(min_length=QUESTIONS, max_length=QUESTIONS)
    answers: List[Side] = Field(min_length=QUESTIONS, max_length=QUESTIONS)

    _name = field_validator("name")(_clean_name)


class SplitRespond(BaseModel):
    name: str = Field(max_length=60)
    answers: List[Side] = Field(min_length=QUESTIONS, max_length=QUESTIONS)

    _name = field_validator("name")(_clean_name)


def _key_hash(key: str) -> str:
    return hashlib.sha256(f"split:{key}".encode()).hexdigest()


def _deck(slugs: List[str]) -> list:
    return [{"slug": s, "motion": MOTIONS_BY_SLUG[s]["motion"], "tag": MOTIONS_BY_SLUG[s]["tag"]}
            for s in slugs if s in MOTIONS_BY_SLUG]


async def _find(code: str) -> dict:
    doc = await db.split_tests.find_one({"code": code}) if _CODE_RE.match(code) else None
    if not doc:
        raise HTTPException(status_code=404, detail="This Split Test doesn't exist")
    return doc


@router.post("/public/split")
async def create_split(
    payload: SplitCreate,
    _rl: None = Depends(rate_limit("split_create", limit=10, window_seconds=3600)),
):
    if len(set(payload.slugs)) != QUESTIONS or any(s not in MOTIONS_BY_SLUG for s in payload.slugs):
        raise HTTPException(status_code=422, detail="Unknown or repeated takes")
    code, key = secrets.token_urlsafe(6), secrets.token_urlsafe(18)
    await db.split_tests.insert_one({
        "code": code, "key_hash": _key_hash(key), "name": payload.name, "slugs": payload.slugs,
        "answers": payload.answers, "responses": [], "created_at": datetime.now(timezone.utc),
    })
    return {"code": code, "key": key}


@router.get("/public/split/{code}")
async def get_split(code: str):
    doc = await _find(code)
    return {"code": doc["code"], "name": doc["name"], "deck": _deck(doc["slugs"]), "responses": len(doc["responses"])}


@router.post("/public/split/{code}/respond")
async def respond_split(
    code: str,
    payload: SplitRespond,
    _rl: None = Depends(rate_limit("split_respond", limit=20, window_seconds=3600)),
):
    doc = await _find(code)
    entry = {"id": secrets.token_urlsafe(6), "name": payload.name, "answers": payload.answers,
             "at": datetime.now(timezone.utc).isoformat()}
    res = await db.split_tests.update_one(
        {"code": code, f"responses.{MAX_RESPONSES - 1}": {"$exists": False}}, {"$push": {"responses": entry}})
    if not res.modified_count:
        raise HTTPException(status_code=409, detail="This Split Test is full")
    return {"name": doc["name"], "deck": _deck(doc["slugs"]), "answers": doc["answers"],
            "me": {"id": entry["id"], "name": entry["name"], "answers": entry["answers"]}}


@router.get("/public/split/{code}/results")
async def split_results(code: str, key: str = ""):
    doc = await _find(code)
    if not key or not secrets.compare_digest(_key_hash(key), doc["key_hash"]):
        raise HTTPException(status_code=403, detail="Only the person who made this Split Test can see everyone")
    return {"code": doc["code"], "name": doc["name"], "deck": _deck(doc["slugs"]), "answers": doc["answers"],
            "responses": [{"id": r["id"], "name": r["name"], "answers": r["answers"], "at": r["at"]}
                          for r in reversed(doc["responses"])]}
