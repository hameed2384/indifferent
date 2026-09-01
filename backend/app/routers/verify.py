import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel

from ..config import STORAGE_DIR, VERIFY_AUTO_APPROVE
from ..db import db
from ..deps import get_current_user, require_admin, require_xhr
from ..models import User

router = APIRouter()


@router.post("/verify/upload")
async def upload_id(file: UploadFile = File(...), user: User = Depends(get_current_user), _xhr: None = Depends(require_xhr)):
    """Local-disk storage on purpose, not the shared Vercel Blob store
    clips.py uses: that store is public (anyone with the URL), and an ID
    document is exactly the kind of thing that must never end up on a
    publicly-guessable URL. Same "doesn't survive a cold start on
    serverless" caveat as before applies, but with no read path beyond the
    admin queue below, that's an interim limitation rather than a live bug.

    Review mode is config.VERIFY_AUTO_APPROVE: auto-approve (today's
    default, unchanged behavior) or a real pending-review queue an admin
    clears via GET /verify/pending + POST /verify/{user_id}/decide."""
    ext = file.filename.rsplit(".", 1)[-1].lower() if file.filename and "." in file.filename else "bin"
    if ext not in {"jpg", "jpeg", "png", "webp", "pdf"}:
        raise HTTPException(status_code=400, detail="Unsupported file type")
    data = await file.read()
    if len(data) > 8 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (8MB max)")
    rel_path = f"verify/{user.user_id}/{uuid.uuid4()}.{ext}"
    dest = Path(STORAGE_DIR) / rel_path
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(data)

    now = datetime.now(timezone.utc).isoformat()
    if VERIFY_AUTO_APPROVE:
        await db.users.update_one(
            {"user_id": user.user_id},
            {"$set": {
                "verification_status": "verified",
                "id_verified": True,
                "verification_doc": rel_path,
                "verified_at": now,
            }},
        )
        return {"status": "verified", "note": "Automatic approval is currently enabled for new accounts."}

    await db.users.update_one(
        {"user_id": user.user_id},
        {"$set": {
            "verification_status": "pending",
            "id_verified": False,
            "verification_doc": rel_path,
            "submitted_at": now,
        }},
    )
    return {"status": "pending", "note": "Submitted for manual review."}


@router.get("/verify/pending")
async def list_pending(_admin: User = Depends(require_admin)):
    docs = await db.users.find(
        {"verification_status": "pending"},
        {"_id": 0, "user_id": 1, "name": 1, "display_name": 1, "email": 1, "verification_doc": 1, "submitted_at": 1},
    ).sort("submitted_at", 1).to_list(200)
    return {"pending": docs}


class VerifyDecision(BaseModel):
    approve: bool


@router.post("/verify/{user_id}/decide")
async def decide_verification(
    user_id: str,
    payload: VerifyDecision,
    _admin: User = Depends(require_admin),
    _xhr: None = Depends(require_xhr),
):
    status = "verified" if payload.approve else "rejected"
    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {
            "verification_status": status,
            "id_verified": bool(payload.approve),
            "decided_at": datetime.now(timezone.utc).isoformat(),
        }},
    )
    return {"status": status}
