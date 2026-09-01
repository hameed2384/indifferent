"""Fan-out helper for the in-app notification center. routers/notifications.py
is the read side (list + mark-read); this is the write side, called
directly from wherever the underlying event actually happens (friends.py,
profiles.py, clips.py, rooms.py) rather than inferred after the fact — the
list a user sees is exactly the events that fired for them, nothing
replayed or reconstructed from other collections.
"""
import uuid
from datetime import datetime, timezone
from typing import Optional

from .db import db


async def create_notification(
    recipient_id: str,
    type: str,
    actor_id: Optional[str] = None,
    actor_name: Optional[str] = None,
    payload: Optional[dict] = None,
):
    if recipient_id == actor_id:
        return  # never notify someone about their own action
    await db.notifications.insert_one({
        "notification_id": f"notif_{uuid.uuid4().hex[:16]}",
        "recipient_id": recipient_id,
        "type": type,
        "actor_id": actor_id,
        "actor_name": actor_name,
        "payload": payload or {},
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
