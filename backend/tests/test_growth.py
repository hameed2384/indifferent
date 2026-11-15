"""Admin growth funnel (GET /admin/growth), counted from the app's own data."""
from datetime import datetime, timedelta, timezone

from app.db import db
from conftest import ADMIN_EMAIL


def _ago(days):
    return (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()


async def test_requires_admin(client, make_user):
    _, headers = await make_user()
    r = await client.get("/api/admin/growth", headers=headers)
    assert r.status_code == 403


async def test_counts_the_funnel_in_the_window(client, make_user):
    _, headers = await make_user(email=ADMIN_EMAIL)
    await db.ai_debates.insert_many([
        # guest rounds: started, finished, finished + claimed into an account
        {"debate_id": "g1", "user_id": "guest:aaa", "via_guest": True, "status": "active", "created_at": _ago(1)},
        {"debate_id": "g2", "user_id": "guest:bbb", "via_guest": True, "status": "ended", "created_at": _ago(1)},
        {"debate_id": "g3", "user_id": "user_1", "via_guest": True, "status": "ended", "claimed_at": _ago(1),
         "share_id": "s1", "created_at": _ago(2)},
        # an older guest round without the via_guest marker still counts as guest
        {"debate_id": "g4", "user_id": "guest:ccc", "status": "active", "created_at": _ago(3)},
        # signed-in rounds
        {"debate_id": "u1", "user_id": "user_2", "status": "ended", "created_at": _ago(1)},
        {"debate_id": "u2", "user_id": "user_2", "status": "active", "created_at": _ago(1)},
        # outside the 7-day window
        {"debate_id": "old", "user_id": "guest:ddd", "via_guest": True, "status": "ended", "created_at": _ago(30)},
    ])

    r = await client.get("/api/admin/growth", params={"days": 7}, headers=headers)
    assert r.status_code == 200
    g = r.json()
    assert g["guest_rounds_started"] == 4
    assert g["guest_rounds_finished"] == 2
    assert g["guest_rounds_claimed"] == 1
    assert g["spar_rounds"] == 2
    assert g["spar_rounds_finished"] == 1
    assert g["reports_shared"] == 1

    r = await client.get("/api/admin/growth", params={"days": 60}, headers=headers)
    assert r.json()["guest_rounds_started"] == 5


async def test_guest_start_and_claim_are_marked(client, make_user, monkeypatch):
    import app.routers.spar as spar
    async def no_llm(*a, **k):
        return None
    monkeypatch.setattr(spar, "call_llm_json", no_llm)

    r = await client.post("/api/spar/guest/start", json={"motion_id": "homework", "side": "for"},
                          headers={"X-Requested-With": "XMLHttpRequest"})
    assert r.status_code == 200, r.text
    d = r.json()
    doc = await db.ai_debates.find_one({"debate_id": d["debate_id"]})
    assert doc["via_guest"] is True

    _, headers = await make_user()
    r = await client.post(f"/api/spar/{d['debate_id']}/claim",
                          headers={**headers, "X-Guest-Token": d["guest_token"]})
    assert r.status_code == 200, r.text
    doc = await db.ai_debates.find_one({"debate_id": d["debate_id"]})
    assert doc["via_guest"] is True and doc.get("claimed_at")
