"""Claim Trees — async video "claims" that reply to each other, forming a
branching tree instead of a flat comment section. A reply forks off its
parent because a rebuttal-to-a-rebuttal is a genuinely different
sub-argument; the tree shape is meant to mirror the debate's own structure.

The uploader can edit the caption, delete the clip, or mark it unlisted.
Deleting a leaf (no replies) removes it outright, deleting one with replies
tombstones it instead so the tree stays intact for its children. Unlisted is
deliberately just one flag, not a full private/unlisted/public tier system
like a debate's archive_visibility: a clip can have other people's replies
depending on it being reachable, so "unlisted" only pulls it out of
discovery/browsing surfaces — the main feed/search (list_root_claims here)
and, for non-owner visitors, the uploader's profile (routers/profiles.py's
list_user_clips). It stays fully visible via a direct link and its place in
the reply tree ("already have the link" / "already part of the thread" are
not discovery), and the owner still sees it on their own profile so they
can find and manage it. There is no fully-private tier because that could
hide a clip out from under a reply that points at it. Category lives only
on the root claim; every reply inherits it so a whole tree always
sorts/filters as one topic.

Video storage uses Vercel Blob (storage.py) — public, persistent object
storage, not the app's own serverless filesystem (which doesn't survive a
cold start). Clips are capped at 4MB, which is what keeps them uploadable
through a single Vercel serverless request at all (the platform's request
body limit is the real constraint here, not an arbitrary product choice) —
in practice that's roughly a 15-20 second clip at a modest bitrate, which
the recording UI enforces client-side.
"""
import re
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import RedirectResponse

from ..categories import CATEGORIES
from ..config import APP_NAME
from ..db import db
from ..deps import get_current_user, require_xhr
from ..models import ClipUpdate, User
from ..reactions import react_once
from ..storage import delete_object, put_object

router = APIRouter()

MAX_CLIP_BYTES = 4 * 1024 * 1024
ALLOWED_EXT = {"webm", "mp4", "mov", "m4v"}
MAX_CAPTION = 200


def _clip_public(doc: dict, uploader: dict) -> dict:
    return {
        "clip_id": doc["clip_id"],
        "uploader_id": doc["uploader_id"],
        "uploader_name": uploader.get("display_name") or uploader.get("name") or "Someone",
        "uploader_picture": uploader.get("picture"),
        "parent_clip_id": doc.get("parent_clip_id"),
        "root_clip_id": doc["root_clip_id"],
        "category": doc["category"],
        "caption": doc["caption"],
        "likes": int(doc.get("likes", 0)),
        "dislikes": int(doc.get("dislikes", 0)),
        "reply_count": int(doc.get("reply_count", 0)),
        "created_at": doc["created_at"],
        "deleted": bool(doc.get("deleted", False)),
        "unlisted": bool(doc.get("unlisted", False)),
    }


@router.post("/clips")
async def upload_clip(
    caption: str = Form(...),
    category: Optional[str] = Form(None),
    parent_clip_id: Optional[str] = Form(None),
    video: UploadFile = File(...),
    user: User = Depends(get_current_user),
    _xhr: None = Depends(require_xhr),
):
    caption = caption.strip()[:MAX_CAPTION]
    if not caption:
        raise HTTPException(status_code=400, detail="Say what your claim or rebuttal is")

    if parent_clip_id:
        parent = await db.clips.find_one({"clip_id": parent_clip_id}, {"_id": 0})
        if not parent:
            raise HTTPException(status_code=404, detail="The clip you're replying to doesn't exist")
        if parent.get("deleted"):
            raise HTTPException(status_code=400, detail="Can't reply to a deleted clip")
        resolved_category = parent["category"]
        root_clip_id = parent["root_clip_id"]
    else:
        if category not in CATEGORIES:
            raise HTTPException(status_code=400, detail="Pick a category for this claim")
        resolved_category = category
        root_clip_id = None  # resolved to our own clip_id once we have one

    ext = (video.filename or "").rsplit(".", 1)[-1].lower() if video.filename and "." in video.filename else ""
    if ext not in ALLOWED_EXT:
        raise HTTPException(status_code=400, detail="Unsupported video format")
    data = await video.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty video")
    if len(data) > MAX_CLIP_BYTES:
        raise HTTPException(status_code=400, detail="Clip is too large — keep it under 4MB (about 15-20 seconds)")

    clip_id = f"clip_{uuid.uuid4().hex[:12]}"
    if root_clip_id is None:
        root_clip_id = clip_id
    result = put_object(f"{APP_NAME}/clips/{clip_id}.{ext}", data, video.content_type or "video/webm")

    now = datetime.now(timezone.utc).isoformat()
    await db.clips.insert_one({
        "clip_id": clip_id,
        "uploader_id": user.user_id,
        "parent_clip_id": parent_clip_id,
        "root_clip_id": root_clip_id,
        "category": resolved_category,
        "caption": caption,
        "video_url": result["url"],
        "likes": 0, "dislikes": 0, "reply_count": 0,
        "created_at": now,
    })
    if parent_clip_id:
        await db.clips.update_one({"clip_id": parent_clip_id}, {"$inc": {"reply_count": 1}})
    return {"clip_id": clip_id}


def _validate_caption(caption: str) -> str:
    caption = caption.strip()[:MAX_CAPTION]
    if not caption:
        raise HTTPException(status_code=400, detail="Say what your claim or rebuttal is")
    return caption


@router.patch("/clips/{clip_id}")
async def update_clip(
    clip_id: str,
    payload: ClipUpdate,
    user: User = Depends(get_current_user),
    _xhr: None = Depends(require_xhr),
):
    """Both fields are optional and independent — the Edit-caption modal
    sends only `caption`, the visibility toggle sends only `unlisted`."""
    doc = await db.clips.find_one({"clip_id": clip_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Clip not found")
    if doc["uploader_id"] != user.user_id:
        raise HTTPException(status_code=403, detail="Not your clip")
    if doc.get("deleted"):
        raise HTTPException(status_code=400, detail="This clip has been deleted")

    update = {}
    if payload.caption is not None:
        update["caption"] = _validate_caption(payload.caption)
    if payload.unlisted is not None:
        update["unlisted"] = payload.unlisted
    if not update:
        raise HTTPException(status_code=400, detail="Nothing to update")

    await db.clips.update_one({"clip_id": clip_id}, {"$set": update})
    return {"clip_id": clip_id, **update}


@router.delete("/clips/{clip_id}")
async def delete_clip(
    clip_id: str,
    user: User = Depends(get_current_user),
    _xhr: None = Depends(require_xhr),
):
    """Hard-delete a leaf (reply_count == 0): nothing points at it as a
    parent, so it's safe to remove outright — doc, blob, and reactions all
    go, and the parent's reply_count is decremented. Soft-delete (tombstone)
    anything with replies — hard-deleting it would orphan every child still
    pointing at this clip_id as parent_clip_id/root_clip_id."""
    doc = await db.clips.find_one({"clip_id": clip_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Clip not found")
    if doc["uploader_id"] != user.user_id:
        raise HTTPException(status_code=403, detail="Not your clip")
    if doc.get("deleted"):
        raise HTTPException(status_code=400, detail="This clip has already been deleted")

    hard = int(doc.get("reply_count", 0)) == 0
    if hard:
        await db.clips.delete_one({"clip_id": clip_id})
        await db.clip_reactions.delete_many({"clip_id": clip_id})
        if doc.get("parent_clip_id"):
            await db.clips.update_one({"clip_id": doc["parent_clip_id"]}, {"$inc": {"reply_count": -1}})
    else:
        await db.clips.update_one(
            {"clip_id": clip_id},
            {"$set": {
                "deleted": True, "caption": "[deleted]", "video_url": None,
                "deleted_at": datetime.now(timezone.utc).isoformat(),
            }},
        )
    if doc.get("video_url"):
        delete_object(doc["video_url"])
    return {"clip_id": clip_id, "deleted": True, "hard_deleted": hard}


@router.get("/clips/roots")
async def list_root_claims(category: Optional[str] = None, q: Optional[str] = None):
    """Registered before /clips/{clip_id} on purpose — both are single-segment
    paths, and FastAPI matches static routes in registration order, so this
    would otherwise never be reached (every request would match {clip_id}
    with "roots" as the id). Unlisted roots are excluded here — this is the
    one surface "unlisted" actually hides a clip from; $ne (not $eq False)
    so it still matches the vast majority of docs that never set the field
    at all, not just ones explicitly set to False."""
    query: dict = {"parent_clip_id": None, "unlisted": {"$ne": True}}
    if category:
        query["category"] = category
    if q:
        query["caption"] = {"$regex": re.escape(q.strip()[:200]), "$options": "i"}
    docs = await db.clips.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    # Batched instead of one find_one() per claim — this feeds the Claims
    # feed page every visitor loads, so up to 100 sequential round-trips
    # per page load was a real, hot N+1, not a minor one.
    uploader_ids = list({d["uploader_id"] for d in docs})
    uploaders = await db.users.find({"user_id": {"$in": uploader_ids}}, {"_id": 0}).to_list(len(uploader_ids)) if uploader_ids else []
    uploader_by_id = {u["user_id"]: u for u in uploaders}
    out = []
    for d in docs:
        uploader = uploader_by_id.get(d["uploader_id"], {})
        out.append(_clip_public(d, uploader))
    return {"claims": out}


@router.get("/clips/{clip_id}")
async def get_clip(clip_id: str):
    doc = await db.clips.find_one({"clip_id": clip_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Clip not found")
    uploader = await db.users.find_one({"user_id": doc["uploader_id"]}, {"_id": 0}) or {}
    out = _clip_public(doc, uploader)
    if doc.get("parent_clip_id"):
        parent = await db.clips.find_one({"clip_id": doc["parent_clip_id"]}, {"_id": 0})
        if parent:
            parent_uploader = await db.users.find_one({"user_id": parent["uploader_id"]}, {"_id": 0}) or {}
            out["parent"] = _clip_public(parent, parent_uploader)
    return out


@router.get("/clips/{clip_id}/replies")
async def list_replies(clip_id: str):
    docs = await db.clips.find({"parent_clip_id": clip_id}, {"_id": 0}).sort("likes", -1).to_list(100)
    uploader_ids = list({d["uploader_id"] for d in docs})
    uploaders = await db.users.find({"user_id": {"$in": uploader_ids}}, {"_id": 0}).to_list(len(uploader_ids)) if uploader_ids else []
    uploader_by_id = {u["user_id"]: u for u in uploaders}
    out = [_clip_public(d, uploader_by_id.get(d["uploader_id"], {})) for d in docs]
    return {"replies": out}


@router.get("/clips/{clip_id}/video")
async def get_clip_video(clip_id: str):
    """Redirects straight to the blob's own public CDN URL rather than
    proxying bytes through this function — the browser hits Vercel's CDN
    directly, same as the docs recommend for public storage, and it keeps
    this a stable, stringable <video src> for every caller regardless of
    where the bytes actually live."""
    doc = await db.clips.find_one({"clip_id": clip_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Clip not found")
    video_url = doc.get("video_url")
    if not video_url:
        # Uploaded before the switch to Vercel Blob — those bytes lived on
        # the app's own serverless filesystem, which doesn't survive a cold
        # start, and are gone for good.
        raise HTTPException(status_code=404, detail="This clip's video is no longer available")
    return RedirectResponse(video_url, status_code=302)


@router.post("/clips/{clip_id}/like")
async def like_clip(clip_id: str, user: User = Depends(get_current_user)):
    doc = await db.clips.find_one({"clip_id": clip_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Clip not found")
    if doc.get("deleted"):
        raise HTTPException(status_code=400, detail="Can't react to a deleted clip")
    if await react_once(db.clip_reactions, "clip_id", clip_id, user.user_id, "like"):
        await db.clips.update_one({"clip_id": clip_id}, {"$inc": {"likes": 1}})
    fresh = await db.clips.find_one({"clip_id": clip_id}, {"_id": 0})
    return {"likes": int(fresh.get("likes", 0))}


@router.post("/clips/{clip_id}/dislike")
async def dislike_clip(clip_id: str, user: User = Depends(get_current_user)):
    doc = await db.clips.find_one({"clip_id": clip_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Clip not found")
    if doc.get("deleted"):
        raise HTTPException(status_code=400, detail="Can't react to a deleted clip")
    if await react_once(db.clip_reactions, "clip_id", clip_id, user.user_id, "dislike"):
        await db.clips.update_one({"clip_id": clip_id}, {"$inc": {"dislikes": 1}})
    fresh = await db.clips.find_one({"clip_id": clip_id}, {"_id": 0})
    return {"dislikes": int(fresh.get("dislikes", 0))}
