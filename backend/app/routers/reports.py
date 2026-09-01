"""User-submitted reports on content or people — the only trust & safety
surface in the app. Create is open to any signed-in user; list/resolve are
admin-only (see deps.require_admin) — the minimal moderation queue that
was deliberately deferred when reporting was first added.
"""
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from ..db import db
from ..deps import get_current_user, require_admin, require_xhr
from ..models import User
from ..ratelimit import rate_limit

router = APIRouter()

TARGET_TYPES = {"clip", "room", "chat_message", "user", "comment"}
REASONS = {"harassment", "hate_speech", "spam", "impersonation", "unsafe_content", "other"}


class ReportCreate(BaseModel):
    target_type: str
    target_id: str
    reason: str
    details: Optional[str] = ""


@router.post("/reports")
async def create_report(
    payload: ReportCreate,
    user: User = Depends(get_current_user),
    _xhr: None = Depends(require_xhr),
    _rl: None = Depends(rate_limit("report", limit=10, window_seconds=3600)),
):
    if payload.target_type not in TARGET_TYPES:
        raise HTTPException(status_code=400, detail="Unknown target_type")
    if payload.reason not in REASONS:
        raise HTTPException(status_code=400, detail="Unknown reason")
    now = datetime.now(timezone.utc).isoformat()
    # Idempotent per (reporter, target): re-reporting the same thing updates
    # the reason/details instead of piling up duplicate rows.
    await db.reports.update_one(
        {"reporter_id": user.user_id, "target_type": payload.target_type, "target_id": payload.target_id},
        {
            "$set": {"reason": payload.reason, "details": (payload.details or "")[:500], "updated_at": now},
            "$setOnInsert": {"status": "open", "created_at": now, "report_id": f"report_{uuid.uuid4().hex[:16]}"},
        },
        upsert=True,
    )
    return {"status": "received"}


@router.get("/reports")
async def list_reports(status: str = "open", _admin: User = Depends(require_admin)):
    docs = await db.reports.find({"status": status}, {"_id": 0}).sort("created_at", -1).to_list(200)
    reporter_ids = list({d["reporter_id"] for d in docs})
    reporters = await db.users.find({"user_id": {"$in": reporter_ids}}, {"_id": 0, "user_id": 1, "display_name": 1, "name": 1}).to_list(len(reporter_ids)) if reporter_ids else []
    name_by_id = {u["user_id"]: (u.get("display_name") or u.get("name") or "Someone") for u in reporters}
    for d in docs:
        d["reporter_name"] = name_by_id.get(d["reporter_id"], "Someone")
    return {"reports": docs}


@router.post("/reports/{report_id}/resolve")
async def resolve_report(report_id: str, _admin: User = Depends(require_admin), _xhr: None = Depends(require_xhr)):
    result = await db.reports.update_one({"report_id": report_id}, {"$set": {"status": "resolved", "resolved_at": datetime.now(timezone.utc).isoformat()}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Report not found")
    return {"status": "resolved"}
