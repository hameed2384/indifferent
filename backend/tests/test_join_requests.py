"""Joining a live debate as a third voice: free while payments are off, but
always requires ID verification (joiners go on camera with strangers)."""
import app.routers.rooms as rooms
from app.db import db


async def _live_room(a, b):
    await db.rooms.insert_one({
        "room_id": "room_live", "user_a": a, "user_b": b, "extra_a": [], "extra_b": [],
        "founding_members": [a, b], "status": "active", "is_public": True,
        "topics": ["t"], "categories": ["cats"], "created_at": "2026-01-01T00:00:00+00:00",
    })


async def _request(client, headers):
    return await client.post("/api/rooms/room_live/join-requests", json={"side": "a"}, headers=headers)


async def test_unverified_user_cannot_join(client, make_user):
    a, _ = await make_user()
    b, _ = await make_user()
    await _live_room(a["user_id"], b["user_id"])
    _, headers = await make_user(onboarded=True)
    r = await _request(client, headers)
    assert r.status_code == 403 and "Verify" in r.json()["detail"]


async def test_verified_user_can_join_without_paying(client, make_user):
    a, _ = await make_user()
    b, _ = await make_user()
    await _live_room(a["user_id"], b["user_id"])
    _, headers = await make_user(onboarded=True, id_verified=True)
    r = await _request(client, headers)
    assert r.status_code == 200 and r.json() == {"status": "pending"}


async def test_subscription_required_once_payments_enabled(client, make_user, monkeypatch):
    monkeypatch.setattr(rooms, "PAYMENTS_ENABLED", True)
    a, _ = await make_user()
    b, _ = await make_user()
    await _live_room(a["user_id"], b["user_id"])
    joiner, headers = await make_user(onboarded=True, id_verified=True)
    assert (await _request(client, headers)).status_code == 403

    await db.subscriptions_debater.insert_one({"subscriber_id": joiner["user_id"], "debater_id": a["user_id"], "active": True})
    assert (await _request(client, headers)).status_code == 200
