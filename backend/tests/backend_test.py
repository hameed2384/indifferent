"""Indifferent backend tests — iteration 2 (public "Watch" feature) + light regression.

Modules covered:
  * health / auth (regression spot-check)
  * matchmaking (used to create a real room)
  * POST /api/rooms/{room_id}/publish  (consent toggle)
  * GET  /api/public/debates
  * GET  /api/public/debates/{room_id}
  * POST /api/public/debates/{room_id}/like
  * WS   /api/ws/watch/{room_id}  (spectator count, comment, like, non-public reject)
  * WS   /api/ws/room/{room_id} -> spectator mirroring (debate-chat)
"""
import asyncio
import json
import os
import re
from pathlib import Path

import pytest
import requests
from dotenv import dotenv_values

import websockets

frontend_env = dotenv_values("/app/frontend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL is missing")
BASE_URL = base_url.rstrip("/")
WS_BASE = BASE_URL.replace("https://", "wss://").replace("http://", "ws://")

TOKEN_A = "test_session_progressive"
TOKEN_B = "test_session_traditional"
TOKEN_C = "test_session_third"  # non-participant persona seeded by the tester

HA = {"Authorization": f"Bearer {TOKEN_A}"}
HB = {"Authorization": f"Bearer {TOKEN_B}"}
HC = {"Authorization": f"Bearer {TOKEN_C}"}

PRE_PUBLISH_TEXT = "TEST_pre_publish_message"
POST_PUBLISH_TEXT = "TEST_post_publish_message"

state = {}


def api(path):
    return f"{BASE_URL}/api{path}"


def run(coro):
    return asyncio.run(coro)


async def recv_json(ws, timeout=10):
    raw = await asyncio.wait_for(ws.recv(), timeout=timeout)
    return json.loads(raw)


async def drain(ws, timeout=2.0):
    out = []
    try:
        while True:
            out.append(await recv_json(ws, timeout=timeout))
    except (asyncio.TimeoutError, TimeoutError):
        pass
    return out


class TestWatchFeature:
    # ---------- regression spot-check ----------
    def test_01_health(self):
        r = requests.get(api("/"), timeout=30)
        assert r.status_code == 200, r.text
        assert r.json() == {"app": "Indifferent", "status": "ok"}

    def test_02_auth_me(self):
        r = requests.get(api("/auth/me"), headers=HA, timeout=30)
        assert r.status_code == 200, r.text
        assert r.json()["user_id"] == "test-user-a"
        assert requests.get(api("/auth/me"), timeout=30).status_code == 401

    # ---------- create a real room via matchmaking ----------
    def test_03_create_room_via_match(self):
        requests.post(api("/match/cancel"), headers=HA, timeout=30)
        requests.post(api("/match/cancel"), headers=HB, timeout=30)
        ra = requests.post(api("/match/enqueue"), headers=HA, timeout=120)
        assert ra.status_code == 200, ra.text
        assert ra.json()["matched"] is False
        rb = requests.post(api("/match/enqueue"), headers=HB, timeout=120)
        assert rb.status_code == 200, rb.text
        body = rb.json()
        assert body["matched"] is True
        assert isinstance(body["room_id"], str) and body["room_id"]
        assert body["opposition_score"] > 0
        assert isinstance(body["topics"], list) and len(body["topics"]) > 0
        state["room_id"] = body["room_id"]
        # b is user_a of the room (b enqueued second and created it)
        rr = requests.get(api(f"/rooms/{body['room_id']}"), headers=HB, timeout=30)
        assert rr.status_code == 200, rr.text
        state["role_b"] = rr.json()["my_role"]

    # ---------- pre-publish chat (must be readable later but NOT live-mirrored) ----------
    def test_04_prepublish_chat_message(self):
        room_id = state["room_id"]

        async def flow():
            url = f"{WS_BASE}/api/ws/room/{room_id}?token={TOKEN_A}"
            async with websockets.connect(url, open_timeout=20) as ws:
                first = await recv_json(ws)
                assert first["type"] == "room-state", first
                await ws.send(json.dumps({"type": "chat", "text": PRE_PUBLISH_TEXT}))
                echo = await recv_json(ws)
                assert echo["type"] == "chat" and echo["text"] == PRE_PUBLISH_TEXT, echo

        run(flow())

    # ---------- publish auth ----------
    def test_05_publish_unauthenticated_401(self):
        r = requests.post(api(f"/rooms/{state['room_id']}/publish"), timeout=30)
        assert r.status_code == 401, f"{r.status_code} {r.text}"

    def test_06_publish_non_participant_403(self):
        r = requests.post(api(f"/rooms/{state['room_id']}/publish"), headers=HC, timeout=30)
        assert r.status_code == 403, f"{r.status_code} {r.text}"

    def test_07_publish_unknown_room_404(self):
        r = requests.post(api("/rooms/room_doesnotexist/publish"), headers=HA, timeout=30)
        assert r.status_code == 404, f"{r.status_code} {r.text}"

    # ---------- single-sided consent ----------
    def test_08_publish_a_only(self):
        r = requests.post(api(f"/rooms/{state['room_id']}/publish"), headers=HA, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        # user_a of the room is whoever the API assigned; identify via my_role
        me = requests.get(api(f"/rooms/{state['room_id']}"), headers=HA, timeout=30).json()["my_role"]
        state["role_a_user"] = me
        flipped = "publish_a" if me == "a" else "publish_b"
        other = "publish_b" if me == "a" else "publish_a"
        assert d[flipped] is True, d
        assert d[other] is False, d
        assert d["is_public"] is False, d

    def test_09_nonpublic_detail_and_like_404(self):
        rid = state["room_id"]
        assert requests.get(api(f"/public/debates/{rid}"), timeout=30).status_code == 404
        assert requests.post(api(f"/public/debates/{rid}/like"), timeout=30).status_code == 404
        lst = requests.get(api("/public/debates"), timeout=30)
        assert lst.status_code == 200, lst.text
        assert rid not in [d["room_id"] for d in lst.json()["debates"]]

    def test_10_ws_watch_nonpublic_rejected(self):
        rid = state["room_id"]

        async def flow():
            try:
                async with websockets.connect(f"{WS_BASE}/api/ws/watch/{rid}", open_timeout=20) as ws:
                    await recv_json(ws, timeout=5)
                return "connected"
            except Exception as e:
                return f"{type(e).__name__}: {e}"

        res = run(flow())
        assert res != "connected", "WS /api/ws/watch accepted a spectator on a NON-public room"
        print(f"non-public watch rejection: {res}")

    # ---------- both consent -> public ----------
    def test_11_publish_b_makes_public(self):
        r = requests.post(api(f"/rooms/{state['room_id']}/publish"), headers=HB, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["publish_a"] is True and d["publish_b"] is True, d
        assert d["is_public"] is True, d
        detail = requests.get(api(f"/public/debates/{state['room_id']}"), timeout=30)
        assert detail.status_code == 200, detail.text
        assert detail.json()["published_at"], "published_at not set when room became public"

    def test_12_list_public_debates_shape(self):
        r = requests.get(api("/public/debates"), timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "debates" in body and isinstance(body["debates"], list)
        item = next((d for d in body["debates"] if d["room_id"] == state["room_id"]), None)
        assert item is not None, "public room missing from /api/public/debates"
        for key in ("room_id", "status", "opposition_score", "topics", "likes", "spectator_count", "side_a", "side_b"):
            assert key in item, f"missing {key} in list item: {item}"
        assert isinstance(item["topics"], list)
        assert isinstance(item["likes"], int)
        assert isinstance(item["spectator_count"], int)
        for side in ("side_a", "side_b"):
            assert set(("display_name", "stance", "id_verified")).issubset(item[side].keys()), item[side]
            assert item[side]["id_verified"] is True
        assert "_id" not in item, "mongo _id leaked in list item"

    def test_13_public_detail_chat_no_sender_leak(self):
        r = requests.get(api(f"/public/debates/{state['room_id']}"), timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        chat = d["chat"]
        assert len(chat) >= 1, "pre-publish chat message not returned"
        texts = [m["text"] for m in chat]
        assert PRE_PUBLISH_TEXT in texts, texts
        for m in chat:
            assert "sender_id" not in m, f"sender_id leaked: {m}"
            for key in ("speaker", "speaker_side", "text"):
                assert key in m, f"missing {key} in chat msg {m}"
            assert m["speaker_side"] in ("a", "b")
            assert ("ts" in m) or ("created_at" in m), f"no timestamp field in chat msg: {m}"
        ts = [m.get("ts") or m.get("created_at") for m in chat]
        assert ts == sorted(ts), "chat not ordered ascending"
        assert isinstance(d["comments"], list)
        state["chat_len"] = len(chat)

    def test_14_like_increments(self):
        rid = state["room_id"]
        before = requests.get(api(f"/public/debates/{rid}"), timeout=30).json()["likes"]
        r = requests.post(api(f"/public/debates/{rid}/like"), timeout=30)
        assert r.status_code == 200, r.text
        assert r.json()["likes"] == before + 1, r.text
        after = requests.get(api(f"/public/debates/{rid}"), timeout=30).json()["likes"]
        assert after == before + 1, f"like not persisted: {before} -> {after}"
        assert requests.post(api("/public/debates/room_nope/like"), timeout=30).status_code == 404

    # ---------- spectator WS ----------
    def test_15_ws_watch_anonymous_comment_and_like(self):
        rid = state["room_id"]

        async def flow():
            async with websockets.connect(f"{WS_BASE}/api/ws/watch/{rid}", open_timeout=20) as ws:
                first = await recv_json(ws)
                assert first["type"] == "spectator-count", first
                assert first["count"] >= 1, first

                await ws.send(json.dumps({"type": "comment", "text": "TEST_spectator_comment"}))
                msg = await recv_json(ws)
                assert msg["type"] == "comment", msg
                assert msg["text"] == "TEST_spectator_comment"
                assert msg["author"] == "anonymous"
                assert msg["authed"] is False
                assert msg.get("ts")

                likes_before = requests.get(api(f"/public/debates/{rid}"), timeout=30).json()["likes"]
                await ws.send(json.dumps({"type": "like"}))
                msg = await recv_json(ws)
                assert msg["type"] == "like", msg
                assert msg["likes"] == likes_before + 1, (msg, likes_before)

        run(flow())
        detail = requests.get(api(f"/public/debates/{rid}"), timeout=30).json()
        assert any(c["text"] == "TEST_spectator_comment" for c in detail["comments"]), detail["comments"]

    def test_16_ws_watch_authed_comment_author(self):
        rid = state["room_id"]

        async def flow():
            url = f"{WS_BASE}/api/ws/watch/{rid}?token={TOKEN_C}"
            async with websockets.connect(url, open_timeout=20) as ws:
                await recv_json(ws)  # spectator-count
                await ws.send(json.dumps({"type": "comment", "text": "TEST_authed_comment"}))
                msg = await recv_json(ws)
                assert msg["type"] == "comment", msg
                assert msg["authed"] is True, msg
                assert msg["author"] == "Casey C", msg

        run(flow())

    def test_17_spectator_count_broadcast_two_spectators(self):
        rid = state["room_id"]

        async def flow():
            async with websockets.connect(f"{WS_BASE}/api/ws/watch/{rid}", open_timeout=20) as w1:
                m1 = await recv_json(w1)
                assert m1["type"] == "spectator-count"
                async with websockets.connect(f"{WS_BASE}/api/ws/watch/{rid}", open_timeout=20) as w2:
                    await recv_json(w2)
                    m = await recv_json(w1)
                    assert m["type"] == "spectator-count" and m["count"] >= 2, m
                    listed = requests.get(api("/public/debates"), timeout=30).json()["debates"]
                    item = next(d for d in listed if d["room_id"] == rid)
                    assert item["spectator_count"] >= 2, item
                m = await recv_json(w1)
                assert m["type"] == "spectator-count", m
                assert m["count"] == 1, m

        run(flow())

    # ---------- e2e mirroring ----------
    def test_18_e2e_participant_chat_mirrors_to_spectator(self):
        rid = state["room_id"]

        async def flow():
            async with websockets.connect(f"{WS_BASE}/api/ws/watch/{rid}", open_timeout=20) as spec:
                first = await recv_json(spec)
                assert first["type"] == "spectator-count"
                purl = f"{WS_BASE}/api/ws/room/{rid}?token={TOKEN_A}"
                async with websockets.connect(purl, open_timeout=20) as pws:
                    await recv_json(pws)  # room-state
                    await pws.send(json.dumps({"type": "chat", "text": POST_PUBLISH_TEXT}))
                    echo = await recv_json(pws)
                    assert echo["type"] == "chat"
                    mirrored = None
                    for _ in range(5):
                        m = await recv_json(spec, timeout=10)
                        if m["type"] == "debate-chat":
                            mirrored = m
                            break
                    assert mirrored is not None, "spectator never received debate-chat"
                    assert mirrored["text"] == POST_PUBLISH_TEXT, mirrored
                    assert mirrored["speaker_side"] in ("a", "b"), mirrored
                    assert mirrored["speaker"], mirrored
                    assert mirrored.get("ts"), mirrored
                    assert "from" not in mirrored and "sender_id" not in mirrored, mirrored
                    # pre-publish message must NOT be replayed live
                    leftover = await drain(spec, timeout=1.5)
                    assert not any(x.get("text") == PRE_PUBLISH_TEXT for x in leftover), leftover

        run(flow())

    # ---------- unpublish ----------
    def test_19_unpublish_flips_is_public_off(self):
        rid = state["room_id"]
        r = requests.post(api(f"/rooms/{rid}/publish"), headers=HA, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        me = state["role_a_user"]
        flipped = "publish_a" if me == "a" else "publish_b"
        assert d[flipped] is False, d
        assert d["is_public"] is False, d
        assert requests.get(api(f"/public/debates/{rid}"), timeout=30).status_code == 404
        lst = requests.get(api("/public/debates"), timeout=30).json()["debates"]
        assert rid not in [x["room_id"] for x in lst]

    def test_20_republish_restores_public(self):
        rid = state["room_id"]
        r = requests.post(api(f"/rooms/{rid}/publish"), headers=HA, timeout=30)
        assert r.status_code == 200, r.text
        assert r.json()["is_public"] is True, r.text
        assert requests.get(api(f"/public/debates/{rid}"), timeout=30).status_code == 200

    # ---------- light regression ----------
    def test_21_regression_onboarding_questions_and_stats(self):
        q = requests.get(api("/onboarding/questions"), timeout=30)
        assert q.status_code == 200, q.text
        assert len(q.json()["questions"]) == 8
        # /dashboard/stats was removed along with the Dashboard page — its
        # fields (debates, minds_changed, stance) live directly on the user
        # doc and are already covered by /auth/me.
        s = requests.get(api("/auth/me"), headers=HA, timeout=30)
        assert s.status_code == 200, s.text
        body = s.json()
        for key in ("debates", "minds_changed", "stance"):
            assert key in body, body

    def test_22_regression_feedback_and_room_403(self):
        rid = state["room_id"]
        r = requests.get(api(f"/rooms/{rid}"), headers=HC, timeout=30)
        assert r.status_code == 403, f"{r.status_code} {r.text}"
        fb = requests.post(api(f"/rooms/{rid}/feedback"), headers=HA,
                           json={"room_id": rid, "rating": 5, "mind_changed": True, "notes": "TEST_notes"}, timeout=30)
        assert fb.status_code == 200, fb.text
        assert fb.json()["ok"] is True
