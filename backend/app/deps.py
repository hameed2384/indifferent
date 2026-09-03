from datetime import datetime, timezone
from typing import Optional

from fastapi import Cookie, Depends, Header, HTTPException, Request

from .config import ADMIN_EMAILS
from .db import db
from .models import User


async def get_current_user(
    request: Request,
    authorization: Optional[str] = Header(None),
    session_token: Optional[str] = Cookie(None),
) -> User:
    token = session_token
    if not token and authorization and authorization.startswith("Bearer "):
        token = authorization.replace("Bearer ", "", 1)
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    session_doc = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session_doc:
        raise HTTPException(status_code=401, detail="Invalid session")

    expires_at = session_doc["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")

    user_doc = await db.users.find_one({"user_id": session_doc["user_id"]}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=401, detail="User not found")
    return User(**user_doc)


async def get_current_user_optional(
    request: Request,
    authorization: Optional[str] = Header(None),
    session_token: Optional[str] = Cookie(None),
) -> Optional[User]:
    """Same resolution as get_current_user, but returns None instead of
    401'ing — for endpoints anonymous callers may legitimately hit (spectator
    comments, watch-page polling) where being logged in just adds attribution."""
    try:
        return await get_current_user(request, authorization, session_token)
    except HTTPException:
        return None


async def require_xhr(x_requested_with: Optional[str] = Header(None)):
    """CSRF mitigation for cookie-authenticated, body-less mutating endpoints
    (a plain cross-site <form method=POST> can't set a custom header). The
    session cookie is SameSite=None in production (required for the
    cross-origin frontend/backend split — see config.COOKIE_SECURE), so it's
    sent on any third-party site's request; a simple request with no custom
    headers and no non-form Content-Type needs no CORS preflight at all, so
    CORS's origin allowlist never even gets consulted. Requiring this header
    forces a preflight, and *that* is what the origin allowlist blocks for
    everything except the real frontend. lib/api.js sets this on every
    request; nothing else needs to opt in per-call. Endpoints that already
    take a real JSON body are already preflighted (implicitly protected) and
    don't need this."""
    if not x_requested_with:
        raise HTTPException(status_code=403, detail="Missing required header")


async def require_admin(user: User = Depends(get_current_user)) -> User:
    """No real role system exists yet — see config.ADMIN_EMAILS. Good enough
    for the one moderator-only surface (verification review) that exists
    today; revisit if/when more admin endpoints show up."""
    import logging
    logging.getLogger("indifferent").info("DIAG require_admin: user.email=%r ADMIN_EMAILS=%r", user.email, ADMIN_EMAILS)
    if user.email.lower() not in ADMIN_EMAILS:
        raise HTTPException(status_code=403, detail="Admin only")
    return user
