import uuid
from datetime import datetime, timezone

import requests
from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile
from pydantic import BaseModel

from ..config import APP_NAME, VERIFY_AUTO_APPROVE
from ..db import db
from ..deps import get_current_user, require_admin, require_xhr
from ..models import User
from ..storage import put_object

router = APIRouter()

_EXT_CONTENT_TYPE = {
    "jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png",
    "webp": "image/webp", "pdf": "application/pdf",
}


@router.post("/verify/upload")
async def upload_id(file: UploadFile = File(...), user: User = Depends(get_current_user), _xhr: None = Depends(require_xhr)):
    """Stored via the same Vercel Blob store clips.py uses, but unlike a
    clip, the resulting URL is NEVER returned to any client — GET
    /verify/{user_id}/document (below) fetches it server-side and streams
    the bytes back only to an authenticated admin, so nothing a browser
    ever sees can be used to reach the document directly. (Vercel's own
    Private Blob + signed URLs would be a stronger guarantee than this
    "URL never leaves the server" approach — worth doing later, not
    implemented here.)

    This used to write to local disk specifically to avoid a public Blob
    URL ever reaching a client. That's solved now without giving up
    durability: local disk doesn't survive a serverless cold start, so a
    submitted document could — and did — vanish before an admin ever got
    to review it, making the manual-review queue this exists for
    structurally pointless. Review mode is config.VERIFY_AUTO_APPROVE:
    auto-approve (skips the queue) or real manual review via GET
    /verify/pending + POST /verify/{user_id}/decide."""
    ext = file.filename.rsplit(".", 1)[-1].lower() if file.filename and "." in file.filename else "bin"
    if ext not in {"jpg", "jpeg", "png", "webp", "pdf"}:
        raise HTTPException(status_code=400, detail="Unsupported file type")
    data = await file.read()
    if len(data) > 8 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (8MB max)")
    content_type = _EXT_CONTENT_TYPE[ext]
    result = put_object(f"{APP_NAME}/verify/{user.user_id}-{uuid.uuid4().hex[:12]}.{ext}", data, content_type)

    now = datetime.now(timezone.utc).isoformat()
    if VERIFY_AUTO_APPROVE:
        await db.users.update_one(
            {"user_id": user.user_id},
            {"$set": {
                "verification_status": "verified",
                "id_verified": True,
                "verification_doc_url": result["url"],
                "verification_doc_type": content_type,
                "verified_at": now,
            }},
        )
        return {"status": "verified", "note": "Automatic approval is currently enabled for new accounts."}

    await db.users.update_one(
        {"user_id": user.user_id},
        {"$set": {
            "verification_status": "pending",
            "id_verified": False,
            "verification_doc_url": result["url"],
            "verification_doc_type": content_type,
            "submitted_at": now,
        }},
    )
    return {"status": "pending", "note": "Submitted for manual review."}


@router.get("/verify/pending")
async def list_pending(_admin: User = Depends(require_admin)):
    docs = await db.users.find(
        {"verification_status": "pending"},
        {"_id": 0, "user_id": 1, "name": 1, "display_name": 1, "email": 1, "submitted_at": 1},
    ).sort("submitted_at", 1).to_list(200)
    return {"pending": docs}


@router.get("/verify/{user_id}/document")
async def get_verification_document(user_id: str, _admin: User = Depends(require_admin)):
    """The one read path for a submitted ID document — proxies the Blob
    object server-side rather than ever handing the browser its real URL
    (see upload_id's docstring for why). Admin-only; nothing else in the
    app links here."""
    doc = await db.users.find_one({"user_id": user_id}, {"_id": 0, "verification_doc_url": 1, "verification_doc_type": 1})
    if not doc or not doc.get("verification_doc_url"):
        raise HTTPException(status_code=404, detail="No document on file")
    resp = requests.get(doc["verification_doc_url"], timeout=15)
    if resp.status_code >= 400:
        raise HTTPException(status_code=502, detail="Couldn't retrieve document")
    return Response(content=resp.content, media_type=doc.get("verification_doc_type") or "application/octet-stream")


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
