import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from ..config import APP_NAME
from ..db import db
from ..deps import get_current_user
from ..models import User
from ..storage import put_object

router = APIRouter()


@router.post("/verify/upload")
async def upload_id(file: UploadFile = File(...), user: User = Depends(get_current_user)):
    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else "bin"
    if ext not in {"jpg", "jpeg", "png", "webp", "pdf"}:
        raise HTTPException(status_code=400, detail="Unsupported file type")
    path = f"{APP_NAME}/verify/{user.user_id}/{uuid.uuid4()}.{ext}"
    data = await file.read()
    if len(data) > 8 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (8MB max)")
    result = put_object(path, data, file.content_type or "application/octet-stream")
    # MVP: auto-approve after storing (MOCKED review — real KYC review deferred)
    await db.users.update_one(
        {"user_id": user.user_id},
        {"$set": {
            "verification_status": "verified",
            "id_verified": True,
            "verification_doc": result["path"],
            "verified_at": datetime.now(timezone.utc).isoformat(),
        }},
    )
    return {"status": "verified", "path": result["path"], "note": "MOCKED auto-approval for MVP"}
