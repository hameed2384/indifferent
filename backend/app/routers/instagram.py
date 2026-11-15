"""Publish prepared posts to the brand's Instagram account, one admin click
at a time (Admin > Marketing). Uses the Instagram Graph API's content
publishing flow with a system-user token that the owner stores in the
environment (INSTAGRAM_ACCESS_TOKEN / INSTAGRAM_USER_ID); the token never
leaves the server and is never logged.

Publishing is split in two calls so each stays well inside a serverless
time limit: /prepare creates the media containers (Instagram downloads the
images), then the page calls /publish every few seconds until Instagram has
finished processing and the post goes live.
"""
import asyncio
import logging
from datetime import datetime, timezone
from typing import Optional

import requests
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from ..config import INSTAGRAM_ACCESS_TOKEN, INSTAGRAM_GRAPH_VERSION, INSTAGRAM_USER_ID, SITE_URL
from ..db import db
from ..deps import require_admin, require_xhr
from ..instagram_posts import HASHTAGS, POSTS, POSTS_BY_ID
from ..models import User

router = APIRouter()
logger = logging.getLogger("indifferent.instagram")

MAX_CAPTION = 2200  # Instagram's caption limit


def _graph_host(token: str) -> str:
    """Tokens from "API setup with Instagram login" start with IG and only
    work on graph.instagram.com; system-user tokens (EAA...) from a business
    portfolio use graph.facebook.com. Paths are the same on both."""
    return "https://graph.instagram.com" if token.startswith("IG") else "https://graph.facebook.com"


class GraphError(Exception):
    pass


def _configured() -> bool:
    return bool(INSTAGRAM_ACCESS_TOKEN and INSTAGRAM_USER_ID)


def _graph_sync(method: str, path: str, params: dict) -> dict:
    url = f"{_graph_host(INSTAGRAM_ACCESS_TOKEN)}/{INSTAGRAM_GRAPH_VERSION}/{path.lstrip('/')}"
    resp = requests.request(method, url, params={**params, "access_token": INSTAGRAM_ACCESS_TOKEN}, timeout=20)
    try:
        data = resp.json()
    except ValueError:
        data = {}
    if resp.status_code >= 400 or "error" in data:
        err = (data.get("error") or {})
        # Only Meta's own message goes back; the request (with the token) never does.
        raise GraphError(err.get("error_user_msg") or err.get("message") or f"Instagram returned HTTP {resp.status_code}")
    return data


async def graph(method: str, path: str, **params) -> dict:
    return await asyncio.to_thread(_graph_sync, method, path, params)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _image_url(name: str) -> str:
    return f"{SITE_URL}/social/{name}"


def _default_caption(post: dict) -> str:
    return f"{post['caption']}\n\n{HASHTAGS}"


async def _states() -> dict:
    docs = await db.instagram_posts.find({}, {"_id": 0}).to_list(500)
    return {d["post_id"]: d for d in docs}


def _public_state(state: Optional[dict]) -> dict:
    state = state or {}
    return {
        "status": state.get("status", "draft"),
        "published_at": state.get("published_at"),
        "permalink": state.get("permalink"),
        "error": state.get("error"),
    }


@router.get("/admin/instagram")
async def instagram_overview(_admin: User = Depends(require_admin)):
    account = None
    account_error = None
    if _configured():
        try:
            account = await graph("GET", INSTAGRAM_USER_ID, fields="username")
            account = {"username": account.get("username")}
        except GraphError as e:
            account_error = str(e)
    states = await _states()
    return {
        "configured": _configured(),
        "account": account,
        "account_error": account_error,
        "posts": [{
            "id": p["id"], "title": p["title"],
            "images": [_image_url(i) for i in p["images"]],
            "caption": _default_caption(p),
            **_public_state(states.get(p["id"])),
        } for p in POSTS],
    }


class PrepareRequest(BaseModel):
    caption: str = Field(..., min_length=1, max_length=MAX_CAPTION)


def _require_ready(post_id: str) -> dict:
    if not _configured():
        raise HTTPException(status_code=400, detail="Instagram isn't connected: add INSTAGRAM_ACCESS_TOKEN and INSTAGRAM_USER_ID in Vercel")
    post = POSTS_BY_ID.get(post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Unknown post")
    return post


@router.post("/admin/instagram/posts/{post_id}/prepare")
async def prepare_post(post_id: str, payload: PrepareRequest, _admin: User = Depends(require_admin), _xhr: None = Depends(require_xhr)):
    """Step 1: hand Instagram the images and caption. Claims the post first so
    a double click can't publish it twice."""
    post = _require_ready(post_id)
    claimed = await db.instagram_posts.find_one(
        {"post_id": post_id, "status": {"$in": ["published", "preparing", "processing"]}}, {"_id": 0},
    )
    if claimed:
        detail = "Already published" if claimed["status"] == "published" else "Already being published"
        raise HTTPException(status_code=409, detail=detail)
    await db.instagram_posts.update_one(
        {"post_id": post_id},
        {"$set": {"post_id": post_id, "status": "preparing", "caption": payload.caption, "started_at": _now(), "error": None}},
        upsert=True,
    )
    try:
        urls = [_image_url(i) for i in post["images"]]
        if len(urls) == 1:
            container = await graph("POST", f"{INSTAGRAM_USER_ID}/media", image_url=urls[0], caption=payload.caption)
        else:
            children = await asyncio.gather(*[
                graph("POST", f"{INSTAGRAM_USER_ID}/media", image_url=u, is_carousel_item="true") for u in urls
            ])
            container = await graph("POST", f"{INSTAGRAM_USER_ID}/media", media_type="CAROUSEL",
                                    children=",".join(c["id"] for c in children), caption=payload.caption)
    except GraphError as e:
        await db.instagram_posts.update_one({"post_id": post_id}, {"$set": {"status": "failed", "error": str(e)}})
        raise HTTPException(status_code=502, detail=f"Instagram refused the post: {e}")
    await db.instagram_posts.update_one({"post_id": post_id}, {"$set": {"status": "processing", "container_id": container["id"]}})
    return {"status": "processing"}


@router.post("/admin/instagram/posts/{post_id}/publish")
async def publish_post(post_id: str, _admin: User = Depends(require_admin), _xhr: None = Depends(require_xhr)):
    """Step 2, called repeatedly: publishes once Instagram has finished
    processing the container. Returns status "processing" until then."""
    _require_ready(post_id)
    state = await db.instagram_posts.find_one({"post_id": post_id}, {"_id": 0})
    if not state or state.get("status") not in ("processing", "published"):
        raise HTTPException(status_code=400, detail="Prepare the post first")
    if state["status"] == "published":
        return _public_state(state)
    try:
        info = await graph("GET", state["container_id"], fields="status_code")
        code = info.get("status_code")
        if code in ("IN_PROGRESS", None):
            return {"status": "processing"}
        if code != "FINISHED":
            raise GraphError(f"Instagram couldn't process the media (status {code})")
        media = await graph("POST", f"{INSTAGRAM_USER_ID}/media_publish", creation_id=state["container_id"])
        try:
            permalink = (await graph("GET", media["id"], fields="permalink")).get("permalink")
        except GraphError:
            permalink = None
    except GraphError as e:
        await db.instagram_posts.update_one({"post_id": post_id}, {"$set": {"status": "failed", "error": str(e)}})
        raise HTTPException(status_code=502, detail=f"Publishing failed: {e}")
    updates = {"status": "published", "media_id": media["id"], "permalink": permalink, "published_at": _now(), "error": None}
    await db.instagram_posts.update_one({"post_id": post_id}, {"$set": updates})
    logger.info("Published Instagram post %s as media %s", post_id, media["id"])
    return _public_state(updates)
