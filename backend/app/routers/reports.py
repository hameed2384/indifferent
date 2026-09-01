"""User-submitted reports on content or people — the only trust & safety
surface in the app until moderation tooling exists. Write-only for now,
same posture as rooms.py's post-debate feedback: capture it so it's there
once a review queue is prioritized, rather than blocking this pass on
building admin tooling too.
"""
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from ..db import db
from ..deps import get_current_user, require_xhr
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
            "$setOnInsert": {"status": "open", "created_at": now},
        },
        upsert=True,
    )
    return {"status": "received"}
