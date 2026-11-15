from datetime import timedelta

from app.db import db
from conftest import ADMIN_EMAIL


async def test_health(client):
    r = await client.get("/api/")
    assert r.status_code == 200


async def test_me_requires_auth(client):
    r = await client.get("/api/auth/me")
    assert r.status_code == 401


async def test_me_rejects_unknown_token(client):
    r = await client.get("/api/auth/me", headers={"Authorization": "Bearer nope"})
    assert r.status_code == 401


async def test_me_rejects_expired_session(client, make_user):
    _, headers = await make_user(session_expires_in=timedelta(seconds=-1))
    r = await client.get("/api/auth/me", headers=headers)
    assert r.status_code == 401
    assert r.json()["detail"] == "Session expired"


async def test_me_with_bearer_token(client, make_user):
    user, headers = await make_user()
    r = await client.get("/api/auth/me", headers=headers)
    assert r.status_code == 200
    body = r.json()
    assert body["user_id"] == user["user_id"]
    assert body["is_admin"] is False


async def test_me_with_session_cookie(client, make_user):
    user, headers = await make_user()
    token = headers["Authorization"].removeprefix("Bearer ")
    client.cookies.set("session_token", token)
    r = await client.get("/api/auth/me")
    assert r.status_code == 200
    assert r.json()["user_id"] == user["user_id"]


async def test_me_flags_admin(client, make_user):
    _, headers = await make_user(email=ADMIN_EMAIL)
    r = await client.get("/api/auth/me", headers=headers)
    assert r.json()["is_admin"] is True


async def test_logout_with_cookie_deletes_session(client, make_user):
    user, headers = await make_user()
    token = headers["Authorization"].removeprefix("Bearer ")
    client.cookies.set("session_token", token)
    r = await client.post("/api/auth/logout")
    assert r.status_code == 200
    assert await db.user_sessions.find_one({"session_token": token}) is None


async def test_logout_with_bearer_deletes_session(client, make_user):
    """Regression: logout used to read only the cookie, leaving Bearer-token
    sessions (the Safari/iOS fallback) valid on the server after logout."""
    _, headers = await make_user()
    await client.post("/api/auth/logout", headers=headers)
    r = await client.get("/api/auth/me", headers=headers)
    assert r.status_code == 401


async def test_logout_only_revokes_own_session(client, make_user):
    _, mine = await make_user()
    _, other = await make_user()
    await client.post("/api/auth/logout", headers=mine)
    assert (await client.get("/api/auth/me", headers=other)).status_code == 200


async def test_logout_clears_cookie(client, make_user):
    _, headers = await make_user()
    r = await client.post("/api/auth/logout", headers=headers)
    set_cookie = r.headers.get("set-cookie", "")
    assert set_cookie.startswith("session_token=")
    assert "Max-Age=0" in set_cookie
