"""Public user profiles + the follow relationship (client brief #9, #11 —
one of three deliberately separate relationship systems: follows here,
friends and subscriptions land with the rest of Phase 3/4).
"""
import re
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from ..db import db
from ..deps import get_current_user, get_current_user_optional, require_xhr
from ..models import User
from ..room_utils import find_live_room_id

router = APIRouter()


class ProfileUpdate(BaseModel):
    display_name: Optional[str] = None
    bio: Optional[str] = None


@router.get("/users/search")
async def search_users(q: str, user: User = Depends(get_current_user)):
    """Powers the Friends page's "find people" box. Registered before
    /users/{user_id} on purpose — both are single-segment paths, and FastAPI
    matches static routes in registration order (same reasoning as
    /clips/roots vs /clips/{clip_id}). Requires auth: every profile this
    returns is already public via /u/{id}, but gating the search itself is
    a cheap, standard deterrent against a script trawling the user list."""
    term = q.strip()
    if len(term) < 2:
        return {"users": []}
    pattern = re.escape(term[:100])
    docs = await db.users.find(
        {
            "user_id": {"$ne": user.user_id},
            "$or": [
                {"display_name": {"$regex": pattern, "$options": "i"}},
                {"name": {"$regex": pattern, "$options": "i"}},
            ],
        },
        {"_id": 0, "user_id": 1, "display_name": 1, "name": 1, "picture": 1, "is_debater": 1, "id_verified": 1},
    ).to_list(20)

    ids = [d["user_id"] for d in docs]
    following_ids = set()
    friend_status_by_id = {}
    if ids:
        following_ids = {
            f["followee_id"]
            async for f in db.follows.find(
                {"follower_id": user.user_id, "followee_id": {"$in": ids}}, {"_id": 0, "followee_id": 1}
            )
        }
        friendship_docs = await db.friendships.find(
            {"$or": [{"user_a": user.user_id, "user_b": {"$in": ids}}, {"user_a": {"$in": ids}, "user_b": user.user_id}]},
            {"_id": 0},
        ).to_list(len(ids))
        for fdoc in friendship_docs:
            other = fdoc["user_b"] if fdoc["user_a"] == user.user_id else fdoc["user_a"]
            if fdoc["status"] == "accepted":
                friend_status_by_id[other] = "friends"
            elif fdoc["requested_by"] == user.user_id:
                friend_status_by_id[other] = "pending_outgoing"
            else:
                friend_status_by_id[other] = "pending_incoming"

    return {"users": [{
        "user_id": d["user_id"],
        "display_name": d.get("display_name") or d.get("name"),
        "picture": d.get("picture"),
        "is_debater": bool(d.get("is_debater")),
        "id_verified": bool(d.get("id_verified")),
        "is_following": d["user_id"] in following_ids,
        "friend_status": friend_status_by_id.get(d["user_id"], "none"),
    } for d in docs]}


@router.get("/users/{user_id}")
async def get_public_profile(user_id: str, viewer: Optional[User] = Depends(get_current_user_optional)):
    doc = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="User not found")
    followers_count = await db.follows.count_documents({"followee_id": user_id})
    following_count = await db.follows.count_documents({"follower_id": user_id})
    is_following = False
    friend_status = "none"  # none | pending_outgoing | pending_incoming | friends
    is_subscribed = False
    if viewer:
        is_following = await db.follows.find_one({"follower_id": viewer.user_id, "followee_id": user_id}) is not None
        friendship = await db.friendships.find_one(
            {"$or": [{"user_a": viewer.user_id, "user_b": user_id}, {"user_a": user_id, "user_b": viewer.user_id}]},
            {"_id": 0},
        )
        if friendship:
            if friendship["status"] == "accepted":
                friend_status = "friends"
            elif friendship["requested_by"] == viewer.user_id:
                friend_status = "pending_outgoing"
            else:
                friend_status = "pending_incoming"
        if doc.get("is_debater"):
            sub = await db.subscriptions_debater.find_one(
                {"subscriber_id": viewer.user_id, "debater_id": user_id, "active": True}, {"_id": 0}
            )
            is_subscribed = sub is not None
    clips_count = await db.clips.count_documents({"uploader_id": user_id})
    return {
        "user_id": user_id,
        "display_name": doc.get("display_name") or doc.get("name"),
        "picture": doc.get("picture"),
        "bio": doc.get("bio") or "",
        "is_debater": bool(doc.get("is_debater", False)),
        "id_verified": bool(doc.get("id_verified", False)),
        "allow_friend_requests": bool(doc.get("allow_friend_requests", True)),
        "followers_count": followers_count,
        "following_count": following_count,
        "debates_count": int(doc.get("debates", 0)),
        "minds_changed": int(doc.get("minds_changed", 0)),
        "clips_count": clips_count,
        "created_at": doc.get("created_at"),
        "is_following": is_following,
        "friend_status": friend_status,
        "is_subscribed": is_subscribed,
        "is_self": bool(viewer and viewer.user_id == user_id),
    }


@router.get("/users/{user_id}/topic-stances")
async def get_topic_stances(user_id: str):
    """Client brief #10 — the list-of-spectrums that replaces the old single
    two-axis square map. Only topics the user has actually been scored on."""
    docs = await db.topic_stances.find({"user_id": user_id}, {"_id": 0}).sort("updated_at", -1).to_list(200)
    return {"topics": docs}


@router.get("/users/{user_id}/debates")
async def list_user_debates(user_id: str):
    """A debater's public archive + live-now status — client brief #9's
    "channel page" half of a profile (topic-stances above is the other
    half). Same public/unlisted visibility rule as the main feed
    (routers/public.py), scoped to rooms this person was any kind of
    participant in — original, party member, or approved joiner."""
    participant_filter = {"$or": [{"user_a": user_id}, {"user_b": user_id}, {"extra_a": user_id}, {"extra_b": user_id}]}
    visibility_filter = {"$or": [{"is_public": True, "status": "active"}, {"archive_visibility": "public"}]}
    docs = await db.rooms.find({"$and": [participant_filter, visibility_filter]}, {"_id": 0}).sort("published_at", -1).to_list(50)
    debates = [{
        "room_id": d["room_id"],
        "status": d.get("status", "active"),
        "categories": d.get("categories", []),
        "topics": d.get("topics", []),
        "likes": int(d.get("likes", 0)),
        "published_at": d.get("published_at"),
    } for d in docs]
    return {"debates": debates, "live_room_id": await find_live_room_id(user_id)}


@router.get("/users/{user_id}/clips")
async def list_user_clips(user_id: str):
    """Claim Trees content this person has posted — root claims and replies
    alike, for the profile's Claims tab (the async-video counterpart to the
    Debates tab above)."""
    docs = await db.clips.find({"uploader_id": user_id}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return {"clips": [{
        "clip_id": d["clip_id"],
        "parent_clip_id": d.get("parent_clip_id"),
        "category": d["category"],
        "caption": d["caption"],
        "likes": int(d.get("likes", 0)),
        "reply_count": int(d.get("reply_count", 0)),
        "created_at": d["created_at"],
    } for d in docs]}


@router.get("/users/me/following")
async def list_following(user: User = Depends(get_current_user)):
    """Powers the sidebar's "Following" section — free, one-directional
    follows (client brief #11), separate from friends and paid subscriptions."""
    docs = await db.follows.find({"follower_id": user.user_id}, {"_id": 0}).sort("created_at", -1).to_list(200)
    out = []
    for d in docs:
        u = await db.users.find_one({"user_id": d["followee_id"]}, {"_id": 0})
        if not u:
            continue
        out.append({
            "user_id": u["user_id"],
            "display_name": u.get("display_name") or u.get("name"),
            "picture": u.get("picture"),
            "is_debater": bool(u.get("is_debater")),
            "live_room_id": await find_live_room_id(u["user_id"]) if u.get("is_debater") else None,
        })
    return {"following": out}


@router.get("/users/me/subscriptions")
async def list_subscriptions(user: User = Depends(get_current_user)):
    """Powers the sidebar's "Subscriptions" section — the £2/mo paid,
    per-debater relationship (client brief #12), separate from follows."""
    docs = await db.subscriptions_debater.find({"subscriber_id": user.user_id, "active": True}, {"_id": 0}).to_list(200)
    out = []
    for d in docs:
        u = await db.users.find_one({"user_id": d["debater_id"]}, {"_id": 0})
        if not u:
            continue
        out.append({
            "user_id": u["user_id"],
            "display_name": u.get("display_name") or u.get("name"),
            "picture": u.get("picture"),
            "live_room_id": await find_live_room_id(u["user_id"]),
        })
    return {"subscriptions": out}


@router.post("/users/me/profile", response_model=User)
async def update_my_profile(payload: ProfileUpdate, user: User = Depends(get_current_user)):
    """Settings page — editing display_name/bio after onboarding wasn't
    possible at all until now; onboarding/submit was the only write path."""
    update = {}
    if payload.display_name is not None:
        name = payload.display_name.strip()[:40]
        if not name:
            raise HTTPException(status_code=400, detail="Display name can't be empty")
        update["display_name"] = name
    if payload.bio is not None:
        update["bio"] = payload.bio.strip()[:300]
    if not update:
        raise HTTPException(status_code=400, detail="Nothing to update")
    await db.users.update_one({"user_id": user.user_id}, {"$set": update})
    doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
    return User(**doc)


@router.post("/users/me/become-debater")
async def become_debater(user: User = Depends(get_current_user), _xhr: None = Depends(require_xhr)):
    """One account, no separate viewer/debater signup (client brief #15) — a
    self-service toggle, same MVP posture as ID verification auto-approving:
    the only gate on actually going live is being onboarded + ID-verified."""
    await db.users.update_one({"user_id": user.user_id}, {"$set": {"is_debater": True}})
    return {"is_debater": True}


@router.post("/users/{user_id}/follow")
async def follow_user(user_id: str, user: User = Depends(get_current_user), _xhr: None = Depends(require_xhr)):
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
async def unfollow_user(user_id: str, user: User = Depends(get_current_user), _xhr: None = Depends(require_xhr)):
    await db.follows.delete_one({"follower_id": user.user_id, "followee_id": user_id})
    return {"following": False}
