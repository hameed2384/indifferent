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
from ..models import User

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
    """Deletes the account and its identity-linked data so the same email
    can sign up completely fresh (auth.py's new-vs-returning check is keyed
    on `users.email` existing at all). Deliberately does NOT touch shared
    content this account was involved in — past debates (rooms), clips,
    chat messages, votes/reactions, debate recordings — deleting those
    would corrupt OTHER real users' history for content they still have a
    legitimate claim to. Every read site that resolves a user_id to a
    profile already degrades gracefully (falls back to a generic label)
    when the user doc is gone, same as an already-deleted clip's uploader.
    """
    target = await db.users.find_one({"user_id": user_id}, {"_id": 0, "email": 1})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if target.get("email", "").lower() in ADMIN_EMAILS:
        raise HTTPException(status_code=400, detail="Can't delete an admin account")

    await db.users.delete_one({"user_id": user_id})
    await db.user_sessions.delete_many({"user_id": user_id})
    await db.friendships.delete_many({"$or": [{"user_a": user_id}, {"user_b": user_id}]})
    await db.follows.delete_many({"$or": [{"follower_id": user_id}, {"followee_id": user_id}]})
    await db.subscriptions_debater.delete_many({"$or": [{"subscriber_id": user_id}, {"debater_id": user_id}]})
    await db.topic_stances.delete_many({"user_id": user_id})
    await db.topic_stance_history.delete_many({"user_id": user_id})
    await db.match_queue.delete_many({"user_id": user_id})
    await db.party_match_queue.delete_many({"user_ids": user_id})
    await db.pending_rooms.delete_many({"user_id": user_id})
    await db.notifications.delete_many({"recipient_id": user_id})
    await db.reports.delete_many({"reporter_id": user_id})
    return {"deleted": True}
