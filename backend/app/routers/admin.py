"""User management for the admin portal (/admin) — search/list, flag,
delete. Everything here is admin-only (deps.require_admin). Kept as its
own router, separate from reports.py/verify.py, since "manage users" is
its own growing surface, not a natural extension of either.
"""
import re
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from ..config import ADMIN_EMAILS
from ..db import db
from ..deps import require_admin, require_xhr
from ..accounts import delete_account
from ..models import User
from ..storage import delete_object

router = APIRouter()


@router.get("/admin/users")
async def list_users(q: Optional[str] = None, limit: int = 50, _admin: User = Depends(require_admin)):
    limit = max(1, min(limit, 200))
    query = {}
    if q and q.strip():
        pattern = re.escape(q.strip()[:100])
        query = {"$or": [
            {"email": {"$regex": pattern, "$options": "i"}},
            {"display_name": {"$regex": pattern, "$options": "i"}},
            {"name": {"$regex": pattern, "$options": "i"}},
            {"handle": {"$regex": pattern, "$options": "i"}},
        ]}
    docs = await db.users.find(query, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return {"users": [{
        "user_id": d["user_id"],
        "email": d.get("email"),
        "display_name": d.get("display_name") or d.get("name"),
        "handle": d.get("handle"),
        "created_at": d.get("created_at"),
        "onboarded": bool(d.get("onboarded")),
        "id_verified": bool(d.get("id_verified")),
        "verification_status": d.get("verification_status", "unstarted"),
        "is_debater": bool(d.get("is_debater")),
        "debates": int(d.get("debates", 0)),
        "referral_count": int(d.get("referral_count", 0)),
        "admin_flagged": bool(d.get("admin_flagged")),
        "admin_flag_note": d.get("admin_flag_note"),
        "is_admin": bool(d.get("email")) and d["email"].lower() in ADMIN_EMAILS,
    } for d in docs]}


class FlagRequest(BaseModel):
    flagged: bool
    note: Optional[str] = ""


@router.post("/admin/users/{user_id}/flag")
async def flag_user(user_id: str, payload: FlagRequest, admin: User = Depends(require_admin), _xhr: None = Depends(require_xhr)):
    """A lightweight moderation marker, distinct from the reports queue —
    admin-only visibility, no automatic enforcement anywhere (matchmaking,
    go-live, etc. don't check this). A deliberate scope limit: turning a
    flag into an actual suspension/ban is a bigger decision (what does it
    block? for how long? appealable?) than "let admins mark an account,"
    which is what was actually asked for."""
    target = await db.users.find_one({"user_id": user_id}, {"_id": 0, "email": 1})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {
            "admin_flagged": payload.flagged,
            "admin_flag_note": (payload.note or "")[:300] if payload.flagged else None,
            "admin_flagged_at": datetime.now(timezone.utc).isoformat() if payload.flagged else None,
            "admin_flagged_by": admin.user_id if payload.flagged else None,
        }},
    )
    return {"admin_flagged": payload.flagged}


@router.delete("/admin/users/{user_id}")
async def delete_user(user_id: str, admin: User = Depends(require_admin), _xhr: None = Depends(require_xhr)):
    """Deletes the account — see app/accounts.py for exactly what goes
    (identity data and personal media) and what's kept but detached
    (shared debate history)."""
    target = await db.users.find_one({"user_id": user_id}, {"_id": 0, "email": 1})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if target.get("email", "").lower() in ADMIN_EMAILS:
        raise HTTPException(status_code=400, detail="Can't delete an admin account")

    return await delete_account(user_id)


@router.delete("/admin/clips/{clip_id}")
async def remove_clip(clip_id: str, _admin: User = Depends(require_admin), _xhr: None = Depends(require_xhr)):
    """Moderator removal of a claim AND its whole reply subtree — unlike the
    uploader's own delete (clips.py delete_clip), which tombstones anything
    with replies to keep other users' rebuttals reachable. For abusive or
    junk content the thread under it goes too: replies to something removed
    for moderation have no context left. Works on already-tombstoned clips,
    so a "[deleted]" placeholder can be cleared out as well. Hard delete:
    clip docs, their reactions and their video blobs; the parent's
    reply_count is corrected if the removed clip was itself a reply."""
    root = await db.clips.find_one({"clip_id": clip_id}, {"_id": 0})
    if not root:
        raise HTTPException(status_code=404, detail="Clip not found")

    # Walk the reply tree breadth-first by parent_clip_id (works for a reply
    # mid-tree too, not just a root claim, unlike filtering on root_clip_id).
    to_remove = [root]
    frontier = [clip_id]
    while frontier:
        children = await db.clips.find({"parent_clip_id": {"$in": frontier}}, {"_id": 0}).to_list(None)
        to_remove.extend(children)
        frontier = [c["clip_id"] for c in children]

    ids = [c["clip_id"] for c in to_remove]
    await db.clips.delete_many({"clip_id": {"$in": ids}})
    await db.clip_reactions.delete_many({"clip_id": {"$in": ids}})
    if root.get("parent_clip_id"):
        await db.clips.update_one({"clip_id": root["parent_clip_id"]}, {"$inc": {"reply_count": -1}})

    delete_object([c["video_url"] for c in to_remove if c.get("video_url")])
    return {"removed": len(ids), "clip_ids": ids}
