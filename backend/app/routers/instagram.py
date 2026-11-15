"""Publish prepared posts to the brand's Instagram account, one admin click
at a time (Admin > Marketing). Uses the Instagram Graph API's content
publishing flow with a token that the owner stores in the
environment (INSTAGRAM_ACCESS_TOKEN / INSTAGRAM_USER_ID); the token never
leaves the server and is never logged.

Publishing is split in two calls so each stays well inside a serverless
time limit: /prepare creates the media containers (Instagram downloads the
images), then the page calls /publish every few seconds until Instagram has
finished processing and the post goes live.
"""
import asyncio
import hashlib
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

import requests
from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field

from ..config import CRON_SECRET, INSTAGRAM_ACCESS_TOKEN, INSTAGRAM_GRAPH_VERSION, INSTAGRAM_USER_ID, SITE_URL
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


def _check(resp) -> dict:
    try:
        data = resp.json()
    except ValueError:
        data = {}
    if resp.status_code >= 400 or "error" in data:
        err = (data.get("error") or {})
        # Only Meta's own message goes back; the request (with the token) never does.
        raise GraphError(err.get("error_user_msg") or err.get("message") or f"Instagram returned HTTP {resp.status_code}")
    return data


def _graph_sync(token: str, method: str, path: str, params: dict) -> dict:
    url = f"{_graph_host(token)}/{INSTAGRAM_GRAPH_VERSION}/{path.lstrip('/')}"
    return _check(requests.request(method, url, params={**params, "access_token": token}, timeout=20))


async def graph(method: str, path: str, **params) -> dict:
    token, _ = await current_token()
    return await asyncio.to_thread(_graph_sync, token, method, path, params)


# --- Token renewal -----------------------------------------------------------
# Instagram-login tokens (IG...) expire 60 days after they're issued, but can
# be swapped for a fresh 60-day token once they're a day old. The renewed
# token is kept in the database (Vercel's environment can't be written from
# the app), tagged with a fingerprint of the env token it came from, so
# pasting a new token into Vercel always takes over again. System-user
# tokens (EAA...) never expire and are left alone.
REFRESH_EVERY = timedelta(days=7)
RETRY_AFTER = timedelta(hours=6)


def _fingerprint(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()[:16]


async def current_token():
    doc = await db.instagram_auth.find_one({"_id": "token"})
    if doc and doc.get("source") == _fingerprint(INSTAGRAM_ACCESS_TOKEN):
        if doc.get("token"):
            return doc["token"], doc
        return INSTAGRAM_ACCESS_TOKEN, doc
    return INSTAGRAM_ACCESS_TOKEN, None


def _refresh_sync(token: str) -> dict:
    return _check(requests.get(
        "https://graph.instagram.com/refresh_access_token",
        params={"grant_type": "ig_refresh_token", "access_token": token}, timeout=20,
    ))


async def maybe_refresh_token() -> Optional[dict]:
    """Renews an IG... token at most weekly; failures are logged and retried
    later rather than blocking the admin page or a publish."""
    if not _configured() or not INSTAGRAM_ACCESS_TOKEN.startswith("IG"):
        return None
    token, doc = await current_token()
    now = datetime.now(timezone.utc)
    doc = doc or {}
    if doc.get("refreshed_at") and now - datetime.fromisoformat(doc["refreshed_at"]) < REFRESH_EVERY:
        return doc
    if doc.get("attempted_at") and now - datetime.fromisoformat(doc["attempted_at"]) < RETRY_AFTER:
        return doc
    base = {"source": _fingerprint(INSTAGRAM_ACCESS_TOKEN), "attempted_at": now.isoformat()}
    try:
        data = await asyncio.to_thread(_refresh_sync, token)
    except GraphError as e:
        logger.warning("Instagram token renewal failed (will retry): %s", e)
        await db.instagram_auth.update_one({"_id": "token"}, {"$set": base}, upsert=True)
        return {**doc, **base}
    updates = {**base, "token": data["access_token"], "refreshed_at": now.isoformat(),
               "expires_at": (now + timedelta(seconds=int(data.get("expires_in") or 0))).isoformat()}
    await db.instagram_auth.update_one({"_id": "token"}, {"$set": updates}, upsert=True)
    logger.info("Instagram token renewed")
    return updates


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _image_url(name: str) -> str:
    return f"{SITE_URL}/social/{name}"


def _default_caption(post: dict) -> str:
    return f"{post['caption']}\n\n{post.get('hashtags') or HASHTAGS}"


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
        "manual": bool(state.get("manual")),
        "scheduled_for": state.get("scheduled_for") if state.get("status") == "scheduled" else None,
    }


@router.get("/admin/instagram")
async def instagram_overview(_admin: User = Depends(require_admin)):
    account = None
    account_error = None
    auth = await maybe_refresh_token()
    if _configured():
        try:
            account = await graph("GET", INSTAGRAM_USER_ID, fields="username")
            account = {"username": account.get("username")}
        except GraphError as e:
            account_error = str(e)
    states = await _states()
    if account:
        # Finish any post the daily job left processing (Instagram was slow).
        for pid, st in list(states.items()):
            if st.get("status") == "processing" and pid in POSTS_BY_ID:
                try:
                    if await _try_finish(pid):
                        states[pid] = await db.instagram_posts.find_one({"post_id": pid}, {"_id": 0})
                except GraphError:
                    states[pid] = await db.instagram_posts.find_one({"post_id": pid}, {"_id": 0})
    return {
        "configured": _configured(),
        "account": account,
        "account_error": account_error,
        "schedule_slot_utc": f"{SLOT_HOUR_UTC:02d}:00",
        "token": {
            "kind": "instagram" if INSTAGRAM_ACCESS_TOKEN.startswith("IG") else "system_user",
            "renewed_at": (auth or {}).get("refreshed_at"),
            "expires_at": (auth or {}).get("expires_at"),
        },
        "posts": [{
            "id": p["id"], "title": p["title"],
            "images": [_image_url(i) for i in p["images"]],
            "video": _image_url(p["video"]) if p.get("video") else None,
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


async def _create_container(post: dict, caption: str) -> str:
    """Hands Instagram the media and caption; returns the container to publish."""
    urls = [_image_url(i) for i in post["images"]]
    if post.get("video"):
        # A Reel: the video, with the first image as its cover; also shown in the profile grid.
        container = await graph("POST", f"{INSTAGRAM_USER_ID}/media", media_type="REELS",
                                video_url=_image_url(post["video"]), cover_url=urls[0] if urls else None,
                                caption=caption, share_to_feed="true")
    elif len(urls) == 1:
        container = await graph("POST", f"{INSTAGRAM_USER_ID}/media", image_url=urls[0], caption=caption)
    else:
        children = await asyncio.gather(*[
            graph("POST", f"{INSTAGRAM_USER_ID}/media", image_url=u, is_carousel_item="true") for u in urls
        ])
        container = await graph("POST", f"{INSTAGRAM_USER_ID}/media", media_type="CAROUSEL",
                                children=",".join(c["id"] for c in children), caption=caption)
    return container["id"]


async def _start(post_id: str, caption: str) -> None:
    """Claims the post and creates its container. Raises GraphError on refusal
    (after recording the failure)."""
    await db.instagram_posts.update_one(
        {"post_id": post_id},
        {"$set": {"post_id": post_id, "status": "preparing", "caption": caption, "started_at": _now(), "error": None}},
        upsert=True,
    )
    try:
        container_id = await _create_container(POSTS_BY_ID[post_id], caption)
    except GraphError as e:
        await db.instagram_posts.update_one({"post_id": post_id}, {"$set": {"status": "failed", "error": str(e)}})
        raise
    await db.instagram_posts.update_one({"post_id": post_id}, {"$set": {"status": "processing", "container_id": container_id}})


async def _try_finish(post_id: str) -> Optional[dict]:
    """Publishes the container if Instagram has finished processing it.
    Returns the new state, or None while it's still processing. Raises
    GraphError (after recording the failure) if Instagram rejected it."""
    state = await db.instagram_posts.find_one({"post_id": post_id}, {"_id": 0})
    if state["status"] == "published":
        return state
    try:
        info = await graph("GET", state["container_id"], fields="status_code")
        code = info.get("status_code")
        if code in ("IN_PROGRESS", None):
            return None
        if code != "FINISHED":
            raise GraphError(f"Instagram couldn't process the media (status {code})")
        media = await graph("POST", f"{INSTAGRAM_USER_ID}/media_publish", creation_id=state["container_id"])
        try:
            permalink = (await graph("GET", media["id"], fields="permalink")).get("permalink")
        except GraphError:
            permalink = None
    except GraphError as e:
        await db.instagram_posts.update_one({"post_id": post_id}, {"$set": {"status": "failed", "error": str(e)}})
        raise
    updates = {"status": "published", "media_id": media["id"], "permalink": permalink, "published_at": _now(), "error": None}
    await db.instagram_posts.update_one({"post_id": post_id}, {"$set": updates})
    logger.info("Published Instagram post %s as media %s", post_id, media["id"])
    return updates


@router.post("/admin/instagram/posts/{post_id}/prepare")
async def prepare_post(post_id: str, payload: PrepareRequest, _admin: User = Depends(require_admin), _xhr: None = Depends(require_xhr)):
    """Step 1: hand Instagram the images and caption. Refuses if the post is
    already out or on its way, so a double click can't publish it twice."""
    _require_ready(post_id)
    await maybe_refresh_token()
    claimed = await db.instagram_posts.find_one(
        {"post_id": post_id, "status": {"$in": ["published", "preparing", "processing"]}}, {"_id": 0},
    )
    if claimed:
        detail = "Already published" if claimed["status"] == "published" else "Already being published"
        raise HTTPException(status_code=409, detail=detail)
    try:
        await _start(post_id, payload.caption)
    except GraphError as e:
        raise HTTPException(status_code=502, detail=f"Instagram refused the post: {e}")
    return {"status": "processing"}


@router.post("/admin/instagram/posts/{post_id}/publish")
async def publish_post(post_id: str, _admin: User = Depends(require_admin), _xhr: None = Depends(require_xhr)):
    """Step 2, called repeatedly: publishes once Instagram has finished
    processing the container. Returns status "processing" until then."""
    _require_ready(post_id)
    state = await db.instagram_posts.find_one({"post_id": post_id}, {"_id": 0})
    if not state or state.get("status") not in ("processing", "published"):
        raise HTTPException(status_code=400, detail="Prepare the post first")
    try:
        done = await _try_finish(post_id)
    except GraphError as e:
        raise HTTPException(status_code=502, detail=f"Publishing failed: {e}")
    return _public_state(done) if done else {"status": "processing"}


@router.post("/admin/instagram/posts/{post_id}/mark-posted")
async def mark_posted(post_id: str, _admin: User = Depends(require_admin), _xhr: None = Depends(require_xhr)):
    """For a post the admin made from the Instagram app instead (a Reel with
    trending music, say): record it as published so it isn't posted twice."""
    if post_id not in POSTS_BY_ID:
        raise HTTPException(status_code=404, detail="Unknown post")
    state = await db.instagram_posts.find_one({"post_id": post_id}, {"_id": 0}) or {}
    if state.get("status") == "published":
        return _public_state(state)
    if state.get("status") in ("preparing", "processing"):
        raise HTTPException(status_code=409, detail="This post is being published right now")
    updates = {"post_id": post_id, "status": "published", "manual": True, "published_at": _now(), "error": None}
    await db.instagram_posts.update_one({"post_id": post_id}, {"$set": updates}, upsert=True)
    return _public_state(updates)


# --- Scheduling -------------------------------------------------------------
# Instagram's API can't schedule posts, so the admin picks a day and a daily
# job (Vercel Cron, see backend/vercel.json) publishes whatever is due at
# SLOT_HOUR_UTC. The job is called with CRON_SECRET, which Vercel sends
# automatically once the variable is set on the project.
SLOT_HOUR_UTC = 17
FINISH_WAIT_SECONDS = 50


class ScheduleRequest(BaseModel):
    date: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    caption: str = Field(..., min_length=1, max_length=MAX_CAPTION)


@router.post("/admin/instagram/posts/{post_id}/schedule")
async def schedule_post(post_id: str, payload: ScheduleRequest, _admin: User = Depends(require_admin), _xhr: None = Depends(require_xhr)):
    _require_ready(post_id)
    try:
        day = datetime.strptime(payload.date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    except ValueError:
        raise HTTPException(status_code=400, detail="Pick a valid date")
    when = day.replace(hour=SLOT_HOUR_UTC)
    if when <= datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="That day's posting time has passed. Pick a later day.")
    state = await db.instagram_posts.find_one({"post_id": post_id}, {"_id": 0}) or {}
    if state.get("status") in ("published", "preparing", "processing"):
        raise HTTPException(status_code=409, detail="This post is already published or on its way")
    updates = {"post_id": post_id, "status": "scheduled", "scheduled_for": when.isoformat(),
               "caption": payload.caption, "error": None}
    await db.instagram_posts.update_one({"post_id": post_id}, {"$set": updates}, upsert=True)
    return _public_state(updates)


@router.delete("/admin/instagram/posts/{post_id}/schedule")
async def unschedule_post(post_id: str, _admin: User = Depends(require_admin), _xhr: None = Depends(require_xhr)):
    state = await db.instagram_posts.find_one({"post_id": post_id}, {"_id": 0}) or {}
    if state.get("status") != "scheduled":
        raise HTTPException(status_code=400, detail="This post isn't scheduled")
    await db.instagram_posts.update_one({"post_id": post_id}, {"$set": {"status": "draft"}, "$unset": {"scheduled_for": ""}})
    return {"status": "draft"}


@router.get("/cron/instagram")
async def run_schedule(authorization: Optional[str] = Header(None)):
    """Daily job: publishes every post whose day has come, waiting a little for
    Instagram to process each one. Posts still processing when time runs out
    are finished on the next run, or when the admin opens Admin > Marketing."""
    if not CRON_SECRET or authorization != f"Bearer {CRON_SECRET}":
        raise HTTPException(status_code=401, detail="Not allowed")
    if not _configured():
        return {"published": [], "failed": [], "pending": [], "note": "Instagram isn't connected"}
    await maybe_refresh_token()
    now = _now()
    due = await db.instagram_posts.find(
        {"$or": [{"status": "scheduled", "scheduled_for": {"$lte": now}}, {"status": "processing"}]}, {"_id": 0},
    ).sort("scheduled_for", 1).to_list(20)
    result = {"published": [], "failed": [], "pending": []}
    for state in due:
        pid = state["post_id"]
        if pid not in POSTS_BY_ID:
            continue
        try:
            if state["status"] == "scheduled":
                caption = state.get("caption") or _default_caption(POSTS_BY_ID[pid])
                await _start(pid, caption)
            done = None
            for _ in range(FINISH_WAIT_SECONDS // 5):
                done = await _try_finish(pid)
                if done:
                    break
                await asyncio.sleep(5)
            result["published" if done else "pending"].append(pid)
        except GraphError as e:
            logger.warning("Scheduled Instagram post %s failed: %s", pid, e)
            result["failed"].append(pid)
    return result
