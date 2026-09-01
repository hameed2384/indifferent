"""In-app notification center — read side. See app/notifications.py for the
write side (create_notification), called from friends.py, profiles.py,
clips.py, and rooms.py at the point each underlying event happens.
"""
from fastapi import APIRouter, Depends

from ..db import db
from ..deps import get_current_user, require_xhr
from ..models import User

router = APIRouter()


@router.get("/notifications")
async def list_notifications(user: User = Depends(get_current_user)):
    docs = await db.notifications.find({"recipient_id": user.user_id}, {"_id": 0}).sort("created_at", -1).to_list(50)
    unread_count = await db.notifications.count_documents({"recipient_id": user.user_id, "read": False})
    return {"notifications": docs, "unread_count": unread_count}


@router.post("/notifications/read-all")
async def mark_all_read(user: User = Depends(get_current_user), _xhr: None = Depends(require_xhr)):
    await db.notifications.update_many({"recipient_id": user.user_id, "read": False}, {"$set": {"read": True}})
    return {"ok": True}
