import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

import requests
from fastapi import APIRouter, Cookie, Depends, HTTPException, Response
from pydantic import BaseModel

from ..config import COOKIE_SECURE, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI
from ..db import db
from ..deps import get_current_user
from ..models import User

router = APIRouter()


def _set_session_cookie(response: Response, token: str):
    response.set_cookie(
        key="session_token",
        value=token,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite="none" if COOKIE_SECURE else "lax",
        path="/",
        max_age=7 * 24 * 60 * 60,
    )


class GoogleAuthCallback(BaseModel):
    code: str
    # Must exactly match what the frontend sent Google in the initial authorize
    # request. Frontend always has it (it built that URL); falls back to
    # GOOGLE_REDIRECT_URI only if the caller omits it.
    redirect_uri: Optional[str] = None
    # A referrer's handle or user_id, captured from ?ref= on first landing
    # (see App.js) and stashed client-side until sign-in actually completes.
    # Only ever applied on a brand-new account below — a returning user
    # logging in again can't retroactively credit someone.
    referred_by: Optional[str] = None


@router.post("/auth/google/callback")
async def google_callback(payload: GoogleAuthCallback, response: Response):
    """Exchange a Google OAuth authorization code for the user's profile, then
    start our own first-party session (cookie) — replaces the old Emergent-
    managed auth proxy with a direct Google OAuth flow."""
    if not (GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET):
        raise HTTPException(status_code=503, detail="Google sign-in not configured")

    token_resp = requests.post(
        "https://oauth2.googleapis.com/token",
        data={
            "code": payload.code,
            "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "redirect_uri": payload.redirect_uri or GOOGLE_REDIRECT_URI,
            "grant_type": "authorization_code",
        },
        timeout=15,
    )
    if token_resp.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid Google authorization code")
    access_token = token_resp.json().get("access_token")

    userinfo_resp = requests.get(
        "https://www.googleapis.com/oauth2/v3/userinfo",
        headers={"Authorization": f"Bearer {access_token}"},
        timeout=15,
    )
    if userinfo_resp.status_code != 200:
        raise HTTPException(status_code=401, detail="Failed to fetch Google profile")
    data = userinfo_resp.json()
    email = data["email"]

    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        user_id = existing["user_id"]
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {"name": data.get("name", ""), "picture": data.get("picture")}},
        )
        user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        user_doc = {
            "user_id": user_id,
            "email": email,
            "name": data.get("name", ""),
            "picture": data.get("picture"),
            "display_name": None,
            "bio": None,
            "stance": None,
            "onboarded": False,
            "id_verified": False,
            "verification_status": "unstarted",
            "debates": 0,
            "minds_changed": 0,
            "referral_count": 0,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        if payload.referred_by:
            ref = payload.referred_by.strip().lstrip("@").lower()
            referrer = await db.users.find_one({"$or": [{"handle": ref}, {"user_id": payload.referred_by.strip()}]}, {"_id": 0, "user_id": 1})
            if referrer and referrer["user_id"] != user_id:
                user_doc["referred_by"] = referrer["user_id"]
                await db.users.update_one({"user_id": referrer["user_id"]}, {"$inc": {"referral_count": 1}})
        await db.users.insert_one(user_doc)

    session_token = uuid.uuid4().hex
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": expires_at.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    _set_session_cookie(response, session_token)
    user_doc.pop("_id", None)
    return {"user": user_doc, "session_token": session_token}


@router.get("/auth/me", response_model=User)
async def auth_me_ep(user: User = Depends(get_current_user)):
    return user


@router.post("/auth/logout")
async def auth_logout(response: Response, session_token: Optional[str] = Cookie(None)):
    if session_token:
        await db.user_sessions.delete_one({"session_token": session_token})
    response.delete_cookie("session_token", path="/")
    return {"ok": True}
