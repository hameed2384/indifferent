"""Public user profiles + the follow relationship (client brief #9, #11 —
one of three deliberately separate relationship systems: follows here,
friends and subscriptions land with the rest of Phase 3/4).
"""
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException

from ..db import db
from ..deps import get_current_user, get_current_user_optional
from ..models import User

router = APIRouter()


@router.get("/users/{user_id}")
async def get_public_profile(user_id: str, viewer: Optional[User] = Depends(get_current_user_optional)):
    doc = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="User not found")
    followers_count = await db.follows.count_documents({"followee_id": user_id})
    following_count = await db.follows.count_documents({"follower_id": user_id})
    is_following = False
    if viewer:
        is_following = await db.follows.find_one({"follower_id": viewer.user_id, "followee_id": user_id}) is not None
    return {
        "user_id": user_id,
        "display_name": doc.get("display_name") or doc.get("name"),
        "picture": doc.get("picture"),
        "bio": doc.get("bio") or "",
        "is_debater": bool(doc.get("is_debater", False)),
        "id_verified": bool(doc.get("id_verified", False)),
        "followers_count": followers_count,
        "following_count": following_count,
        "is_following": is_following,
        "is_self": bool(viewer and viewer.user_id == user_id),
    }


@router.post("/users/me/become-debater")
async def become_debater(user: User = Depends(get_current_user)):
    """One account, no separate viewer/debater signup (client brief #15) — a
    self-service toggle, same MVP posture as ID verification auto-approving:
    the only gate on actually going live is being onboarded + ID-verified."""
    await db.users.update_one({"user_id": user.user_id}, {"$set": {"is_debater": True}})
    return {"is_debater": True}


@router.post("/users/{user_id}/follow")
async def follow_user(user_id: str, user: User = Depends(get_current_user)):
    if user_id == user.user_id:
        raise HTTPException(status_code=400, detail="Can't follow yourself")
    target = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    await db.follows.update_one(
        {"follower_id": user.user_id, "followee_id": user_id},
        {"$setOnInsert": {
            "follower_id": user.user_id, "followee_id": user_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }},
        upsert=True,
    )
    return {"following": True}


@router.delete("/users/{user_id}/follow")
async def unfollow_user(user_id: str, user: User = Depends(get_current_user)):
    await db.follows.delete_one({"follower_id": user.user_id, "followee_id": user_id})
    return {"following": False}
