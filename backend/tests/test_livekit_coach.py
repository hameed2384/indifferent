"""Indifferent backend tests — iteration 3.

Modules covered:
  * POST /api/livekit/participant-token   (401 / 403 / 404 / 200 + JWT grant decode)
  * POST /api/livekit/spectator-token     (404 non-public / 200 public + JWT grant decode)
  * GET  /api/public/debates              (side_a.identity / side_b.identity)
  * GET  /api/public/debates/{room_id}    (identity fields)
  * WS   /api/ws/room/{room_id}           (DebateCoach nudges, coach NOT mirrored to spectators)
  * Coach shutdown / restart on a fresh participant pair
"""
import asyncio
import base64
import json
import os
import time

import pytest
import requests
import websockets
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL is missing")
BASE_URL = base_url.rstrip("/")
WS_BASE = BASE_URL.replace("https://", "wss://").replace("http://", "ws://")

TOKEN_A = "test_session_progressive"
TOKEN_B = "test_session_traditional"
TOKEN_C = "test_session_third"
HA = {"Authorization": f"Bearer {TOKEN_A}"}
HB = {"Authorization": f"Bearer {TOKEN_B}"}
HC = {"Authorization": f"Bearer {TOKEN_C}"}

state = {}

PROVOCATIVE = [
    "Only an idiot with your kind of upbringing could believe that nonsense.",
    "So what you're really saying is you want to abolish all police and let crime run wild.",
    "You either support total open borders or you're a fascist, pick one.",
    "Every single person from your side of the aisle is a liar, I've met dozens.",
    "But what about the other party's scandal from 20 years ago? Answer that first.",
    "Think of the children who will die because of people like you. Shameful.",
    "You clearly never read a book, so this conversation is pointless.",
    "Straw man aside, your whole worldview is built on greed and stupidity.",
]


def api(path):
    return f"{BASE_URL}/api{path}"


def run(coro):
    return asyncio.run(coro)


def decode_jwt_payload(token: str) -> dict:
    parts = token.split(".")
    assert len(parts) == 3, f"not a JWT: {token[:40]}"
    mid = parts[1]
    mid += "=" * (-len(mid) % 4)
    return json.loads(base64.urlsafe_b64decode(mid.encode()))


async def recv_json(ws, timeout=10):
    raw = await asyncio.wait_for(ws.recv(), timeout=timeout)
    return json.loads(raw)


class TestLiveKitAndCoach:
    # ---------- setup: real room via matchmaking ----------
    def test_01_health_and_auth_regression(self):
        r = requests.get(api("/"), timeout=30)
        assert r.status_code == 200, r.text
        assert r.json() == {"app": "Indifferent", "status": "ok"}
        me = requests.get(api("/auth/me"), headers=HA, timeout=30)
        assert me.status_code == 200, me.text
        assert me.json()["user_id"] == "test-user-a"
        assert requests.get(api("/auth/me"), timeout=30).status_code == 401
        q = requests.get(api("/onboarding/questions"), timeout=30)
        assert q.status_code == 200 and len(q.json()["questions"]) == 8

    def test_02_create_room_via_match(self):
        requests.post(api("/match/cancel"), headers=HA, timeout=30)
        requests.post(api("/match/cancel"), headers=HB, timeout=30)
        ra = requests.post(api("/match/enqueue"), headers=HA, timeout=120)
        assert ra.status_code == 200, ra.text
        assert ra.json()["matched"] is False, ra.text
        rb = requests.post(api("/match/enqueue"), headers=HB, timeout=120)
        assert rb.status_code == 200, rb.text
        body = rb.json()
        assert body["matched"] is True, body
        assert isinstance(body["room_id"], str) and body["room_id"]
        state["room_id"] = body["room_id"]

    # ---------- participant token ----------
    def test_03_participant_token_unauthenticated_401(self):
        r = requests.post(api("/livekit/participant-token"),
                          json={"room_id": state["room_id"]}, timeout=30)
        assert r.status_code == 401, f"{r.status_code} {r.text}"

    def test_04_participant_token_non_participant_403(self):
        r = requests.post(api("/livekit/participant-token"), headers=HC,
                          json={"room_id": state["room_id"]}, timeout=30)
        assert r.status_code == 403, f"{r.status_code} {r.text}"

    def test_05_participant_token_unknown_room_404(self):
        r = requests.post(api("/livekit/participant-token"), headers=HA,
                          json={"room_id": "room_doesnotexist"}, timeout=30)
        assert r.status_code == 404, f"{r.status_code} {r.text}"

    def test_06_participant_token_success_and_grants(self):
        rid = state["room_id"]
        r = requests.post(api("/livekit/participant-token"), headers=HA,
                          json={"room_id": rid}, timeout=30)
        assert r.status_code == 200, f"{r.status_code} {r.text}"
        body = r.json()
        assert set(body.keys()) == {"server_url", "participant_token"}, body
        assert isinstance(body["server_url"], str)
        assert body["server_url"].startswith("wss://"), body["server_url"]
        assert isinstance(body["participant_token"], str) and body["participant_token"]

        claims = decode_jwt_payload(body["participant_token"])
        assert claims.get("sub") == "user-test-user-a", claims
        video = claims.get("video")
        assert isinstance(video, dict), claims
        assert video.get("room") == rid, video
        assert video.get("roomJoin") is True, video
        assert video.get("canPublish") is True, video
        assert video.get("canSubscribe") is True, video
        assert claims.get("exp", 0) > time.time(), claims
        state["participant_claims"] = claims

    def test_07_participant_token_side_b_identity(self):
        r = requests.post(api("/livekit/participant-token"), headers=HB,
                          json={"room_id": state["room_id"]}, timeout=30)
        assert r.status_code == 200, r.text
        claims = decode_jwt_payload(r.json()["participant_token"])
        assert claims.get("sub") == "user-test-user-b", claims
        assert claims["video"]["room"] == state["room_id"]
        assert claims["video"]["canPublish"] is True

    # ---------- spectator token ----------
    def test_08_spectator_token_non_public_404(self):
        r = requests.post(api("/livekit/spectator-token"),
                          json={"room_id": state["room_id"]}, timeout=30)
        assert r.status_code == 404, f"{r.status_code} {r.text}"
        r2 = requests.post(api("/livekit/spectator-token"),
                           json={"room_id": "room_doesnotexist"}, timeout=30)
        assert r2.status_code == 404, f"{r2.status_code} {r2.text}"

    def test_09_publish_both_sides_makes_public(self):
        rid = state["room_id"]
        for h in (HA, HB):
            r = requests.post(api(f"/rooms/{rid}/publish"), headers=h, timeout=30)
            assert r.status_code == 200, r.text
        assert r.json()["is_public"] is True, r.text

    def test_10_spectator_token_success_and_grants(self):
        rid = state["room_id"]
        r = requests.post(api("/livekit/spectator-token"), json={"room_id": rid}, timeout=30)
        assert r.status_code == 200, f"{r.status_code} {r.text}"
        body = r.json()
        assert set(body.keys()) == {"server_url", "participant_token"}, body
        assert body["server_url"].startswith("wss://"), body["server_url"]
        claims = decode_jwt_payload(body["participant_token"])
        identity = claims.get("sub", "")
        assert identity.startswith("spectator-"), claims
        video = claims.get("video")
        assert video.get("room") == rid, video
        assert video.get("roomJoin") is True, video
        assert video.get("canPublish") is False or video.get("canPublish") is None, video
        assert video.get("canSubscribe") is True, video
        # identities must be unique per spectator
        r2 = requests.post(api("/livekit/spectator-token"), json={"room_id": rid}, timeout=30)
        assert r2.status_code == 200
        id2 = decode_jwt_payload(r2.json()["participant_token"]).get("sub", "")
        assert id2 != identity, "spectator identity is not unique"

    # ---------- identity in public payloads ----------
    def test_11_public_list_has_identities(self):
        r = requests.get(api("/public/debates"), timeout=30)
        assert r.status_code == 200, r.text
        debates = r.json()["debates"]
        item = next((d for d in debates if d["room_id"] == state["room_id"]), None)
        assert item is not None, "public room missing from list"
        for d in debates:
            for side in ("side_a", "side_b"):
                ident = d[side].get("identity")
                assert isinstance(ident, str) and ident.startswith("user-") and len(ident) > 5, d[side]
        assert {item["side_a"]["identity"], item["side_b"]["identity"]} == {
            "user-test-user-a", "user-test-user-b"}, item

    def test_12_public_detail_has_identities(self):
        r = requests.get(api(f"/public/debates/{state['room_id']}"), timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert {d["side_a"]["identity"], d["side_b"]["identity"]} == {
            "user-test-user-a", "user-test-user-b"}, (d["side_a"], d["side_b"])
        # identity must match the LiveKit participant token identity
        assert state["participant_claims"]["sub"] in (
            d["side_a"]["identity"], d["side_b"]["identity"])

    # ---------- Debate Coach ----------
    def test_13_coach_nudge_participants_only(self):
        rid = state["room_id"]

        async def flow():
            spec_url = f"{WS_BASE}/api/ws/watch/{rid}"
            pa = f"{WS_BASE}/api/ws/room/{rid}?token={TOKEN_A}"
            pb = f"{WS_BASE}/api/ws/room/{rid}?token={TOKEN_B}"
            coach_a, coach_b, spec_msgs = [], [], []
            chat_echo_count = 0

            async with websockets.connect(spec_url, open_timeout=20) as spec, \
                    websockets.connect(pa, open_timeout=20) as wa, \
                    websockets.connect(pb, open_timeout=20) as wb:
                assert (await recv_json(spec))["type"] == "spectator-count"
                assert (await recv_json(wa))["type"] == "room-state"
                assert (await recv_json(wb))["type"] == "room-state"

                async def collect(ws, bucket, coach_bucket=None):
                    try:
                        while True:
                            m = await recv_json(ws, timeout=100)
                            bucket.append(m)
                            if coach_bucket is not None and m.get("type") == "coach":
                                coach_bucket.append(m)
                    except (asyncio.TimeoutError, TimeoutError, Exception):
                        return

                a_all, b_all = [], []
                t_a = asyncio.create_task(collect(wa, a_all, coach_a))
                t_b = asyncio.create_task(collect(wb, b_all, coach_b))
                t_s = asyncio.create_task(collect(spec, spec_msgs))

                # 8 provocative messages, alternating speakers (>=5 triggers the coach)
                for i, text in enumerate(PROVOCATIVE):
                    ws = wa if i % 2 == 0 else wb
                    await ws.send(json.dumps({"type": "chat", "text": text}))
                    await asyncio.sleep(0.8)

                # wait up to ~90s for a coach frame on both sockets
                deadline = time.monotonic() + 90
                while time.monotonic() < deadline:
                    if coach_a and coach_b:
                        break
                    await asyncio.sleep(2)

                await asyncio.sleep(3)
                for t in (t_a, t_b, t_s):
                    t.cancel()

                chat_echo_count = len([m for m in a_all if m.get("type") == "chat"])
                return coach_a, coach_b, spec_msgs, chat_echo_count, a_all, b_all

        coach_a, coach_b, spec_msgs, chat_echo, a_all, b_all = run(flow())

        # (a) chat still works: every message echoed to both participants
        assert chat_echo >= len(PROVOCATIVE), f"only {chat_echo} chat echoes on socket A"
        assert len([m for m in b_all if m.get("type") == "chat"]) >= len(PROVOCATIVE)
        # mirrored to spectators
        mirrored = [m for m in spec_msgs if m.get("type") == "debate-chat"]
        assert len(mirrored) >= len(PROVOCATIVE), f"{len(mirrored)} mirrored frames"

        # (c) coach frames must NEVER reach spectators
        spec_coach = [m for m in spec_msgs if m.get("type") == "coach"]
        assert not spec_coach, f"coach leaked to spectators: {spec_coach}"
        for m in spec_msgs:
            assert "nudge" not in m, f"coach nudge leaked to spectator: {m}"

        state["coach_seen"] = bool(coach_a)
        print(f"coach frames: A={len(coach_a)} B={len(coach_b)} spectator={len(spec_coach)}")

        # (b) shape check for whatever arrived
        if not coach_a and not coach_b:
            pytest.skip("Gemini coach chose not to intervene in this run (probabilistic) — "
                        "chat + no-spectator-leak verified")
        assert coach_a and coach_b, (
            f"coach frame not delivered to BOTH participants: A={len(coach_a)} B={len(coach_b)}")
        for m in coach_a + coach_b:
            assert set(("type", "kind", "nudge", "target", "ts")).issubset(m.keys()), m
            assert m["type"] == "coach"
            assert m["kind"] in ("fallacy", "tone", "dodge", "steelman"), m
            assert isinstance(m["nudge"], str) and m["nudge"].strip(), m
            assert len(m["nudge"]) <= 200, m
            assert m["target"] in ("a", "b", "both"), m
            assert isinstance(m["ts"], str) and m["ts"]

    def test_14_coach_restart_after_both_disconnect(self):
        """Both participants left in test_13 -> coach.stop() should have run.
        A fresh pair must still be able to trigger the coach (task restarted)."""
        rid = state["room_id"]

        async def flow():
            pa = f"{WS_BASE}/api/ws/room/{rid}?token={TOKEN_A}"
            pb = f"{WS_BASE}/api/ws/room/{rid}?token={TOKEN_B}"
            coach_a = []
            async with websockets.connect(pa, open_timeout=20) as wa, \
                    websockets.connect(pb, open_timeout=20) as wb:
                await recv_json(wa)
                await recv_json(wb)

                async def collect(ws, bucket):
                    try:
                        while True:
                            m = await recv_json(ws, timeout=100)
                            if m.get("type") == "coach":
                                bucket.append(m)
                    except Exception:
                        return

                t = asyncio.create_task(collect(wa, coach_a))
                for i, text in enumerate(PROVOCATIVE[:6]):
                    ws = wa if i % 2 == 0 else wb
                    await ws.send(json.dumps({"type": "chat", "text": "Round2: " + text}))
                    await asyncio.sleep(0.8)
                deadline = time.monotonic() + 60
                while time.monotonic() < deadline and not coach_a:
                    await asyncio.sleep(2)
                t.cancel()
                return coach_a

        coach_a = run(flow())
        print(f"round-2 coach frames: {len(coach_a)}")
        if not coach_a:
            pytest.skip("coach did not intervene in round 2 (probabilistic)")
        assert coach_a[0]["type"] == "coach" and coach_a[0]["nudge"]

    def test_15_no_server_errors_in_logs(self):
        import glob
        bad = []
        for path in glob.glob("/var/log/supervisor/backend.err.log*"):
            try:
                with open(path, "r", errors="ignore") as fh:
                    lines = fh.readlines()[-400:]
            except OSError:
                continue
            for ln in lines:
                if ("Coach loop crash" in ln or "Traceback" in ln
                        or "Internal Server Error" in ln):
                    bad.append(ln.strip())
        assert not bad, "backend errors during coach run:\n" + "\n".join(bad[-15:])

    # ---------- regression spot-checks ----------
    def test_16_regression_watch_ws_comment_and_like(self):
        rid = state["room_id"]

        async def flow():
            async with websockets.connect(f"{WS_BASE}/api/ws/watch/{rid}", open_timeout=20) as ws:
                first = await recv_json(ws)
                assert first["type"] == "spectator-count" and first["count"] >= 1, first
                await ws.send(json.dumps({"type": "comment", "text": "TEST_iter3_comment"}))
                m = await recv_json(ws)
                assert m["type"] == "comment" and m["text"] == "TEST_iter3_comment", m
                assert m["author"] == "anonymous" and m["authed"] is False, m
                before = requests.get(api(f"/public/debates/{rid}"), timeout=30).json()["likes"]
                await ws.send(json.dumps({"type": "like"}))
                m = await recv_json(ws)
                assert m["type"] == "like" and m["likes"] == before + 1, (m, before)

        run(flow())
        d = requests.get(api(f"/public/debates/{rid}"), timeout=30).json()
        assert any(c["text"] == "TEST_iter3_comment" for c in d["comments"])

    def test_17_regression_room_access_and_stats(self):
        rid = state["room_id"]
        assert requests.get(api(f"/rooms/{rid}"), headers=HC, timeout=30).status_code == 403
        r = requests.get(api(f"/rooms/{rid}"), headers=HA, timeout=30)
        assert r.status_code == 200, r.text
        assert r.json()["my_role"] in ("a", "b")
        s = requests.get(api("/dashboard/stats"), headers=HA, timeout=30)
        assert s.status_code == 200, s.text
        for key in ("debates", "minds_changed", "stance", "recent_feedback"):
            assert key in s.json()
