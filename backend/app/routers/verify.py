import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from ..config import STORAGE_DIR
from ..db import db
from ..deps import get_current_user
from ..models import User

router = APIRouter()


@router.post("/verify/upload")
async def upload_id(file: UploadFile = File(...), user: User = Depends(get_current_user)):
    """Local-disk storage on purpose, not the shared Vercel Blob store
    clips.py uses: that store is public (anyone with the URL), and an ID
    document is exactly the kind of thing that must never end up on a
    publicly-guessable URL. Verification is fully mocked (auto-approved
    below, no review of the file ever happens), so nothing currently reads
    this back — it only exists to preserve the shape of a real KYC review
    if one gets built later. Same "doesn't survive a cold start on
    serverless" caveat as before applies, but with no read path, that's
    inert rather than a live bug."""
    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else "bin"
    if ext not in {"jpg", "jpeg", "png", "webp", "pdf"}:
        raise HTTPException(status_code=400, detail="Unsupported file type")
    data = await file.read()
    if len(data) > 8 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (8MB max)")
    rel_path = f"verify/{user.user_id}/{uuid.uuid4()}.{ext}"
    dest = Path(STORAGE_DIR) / rel_path
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(data)
    # MVP: auto-approve after storing (MOCKED review — real KYC review deferred)
    await db.users.update_one(
        {"user_id": user.user_id},
        {"$set": {
            "verification_status": "verified",
            "id_verified": True,
            "verification_doc": rel_path,
            "verified_at": datetime.now(timezone.utc).isoformat(),
        }},
    )
    return {"status": "verified", "path": rel_path, "note": "MOCKED auto-approval for MVP"}
