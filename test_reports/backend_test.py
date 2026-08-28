"""Backend test for Indifferent app."""
import asyncio
import json
import os
import sys
import base64
import io

import requests
import websockets

BASE = "https://indifferent-app.preview.emergentagent.com"
TOK_A = "test_session_progressive"
TOK_B = "test_session_traditional"

results = {"passed": [], "failed": []}

def rec_pass(name):
    print(f"PASS: {name}")
    results["passed"].append(name)

def rec_fail(name, evidence):
    print(f"FAIL: {name} - {evidence}")
    results["failed"].append({"area": name, "evidence": evidence})


def h(tok):
    return {"Authorization": f"Bearer {tok}"}


def test_root():
    r = requests.get(f"{BASE}/api/", timeout=15)
    if r.status_code == 200 and r.json().get("app") == "Indifferent" and r.json().get("status") == "ok":
        rec_pass("GET /api/")
    else:
        rec_fail("GET /api/", f"{r.status_code} {r.text[:200]}")


def test_questions():
    r = requests.get(f"{BASE}/api/onboarding/questions", timeout=15)
    if r.status_code == 200:
        qs = r.json().get("questions", [])
        if len(qs) == 8 and all("id" in q and "text" in q for q in qs):
            rec_pass("GET /api/onboarding/questions returns 8 items")
        else:
            rec_fail("GET /api/onboarding/questions", f"count={len(qs)}")
    else:
        rec_fail("GET /api/onboarding/questions", f"{r.status_code} {r.text[:200]}")


def test_auth_missing():
    r = requests.get(f"{BASE}/api/auth/me", timeout=15)
    if r.status_code == 401:
        rec_pass("GET /api/auth/me without token -> 401")
    else:
        rec_fail("Auth me no token", f"{r.status_code} {r.text[:200]}")


def test_auth_me():
    r = requests.get(f"{BASE}/api/auth/me", headers=h(TOK_A), timeout=15)
    if r.status_code == 200 and r.json().get("user_id") == "test-user-a":
        rec_pass("GET /api/auth/me with bearer returns user")
    else:
        rec_fail("Auth me with token", f"{r.status_code} {r.text[:200]}")


def test_ws_ticket():
    r = requests.get(f"{BASE}/api/auth/ws-ticket", headers=h(TOK_A), timeout=15)
    if r.status_code == 200 and r.json().get("ticket") == TOK_A:
        rec_pass("GET /api/auth/ws-ticket")
    else:
        rec_fail("ws-ticket", f"{r.status_code} {r.text[:200]}")


def test_onboarding_submit():
    # Use a temp user to avoid disturbing seeded users
    import pymongo
    from datetime import datetime, timedelta, timezone
    m = pymongo.MongoClient("mongodb://localhost:27017")
    db = m["test_database"]
    uid = "test-onboard-user"
    tok = "test_session_onboard"
    db.users.delete_many({"user_id": uid})
    db.user_sessions.delete_many({"user_id": uid})
    db.users.insert_one({
        "user_id": uid, "email": "onboard@test.local", "name": "OB", "display_name": "OB",
        "picture": None, "bio": "", "stance": None, "onboarded": False,
        "id_verified": False, "verification_status": "unstarted", "debates": 0,
        "minds_changed": 0, "created_at": datetime.now(timezone.utc).isoformat(),
    })
    db.user_sessions.insert_one({
        "user_id": uid, "session_token": tok,
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    payload = {
        "quiz_answers": {"q1": 1, "q2": 5, "q3": 1, "q4": 5, "q5": 1, "q6": 1, "q7": 1, "q8": 5},
        "free_text": "I believe in free markets, low taxes, traditional families and strong borders.",
        "display_name": "OB Test",
        "bio": "tester",
    }
    r = requests.post(f"{BASE}/api/onboarding/submit", headers=h(tok), json=payload, timeout=60)
    if r.status_code != 200:
        rec_fail("POST /api/onboarding/submit", f"{r.status_code} {r.text[:300]}")
        return None, None
    body = r.json()
    st = body.get("stance") or {}
    econ, soc = st.get("economic"), st.get("social")
    ok_range = isinstance(econ, (int, float)) and isinstance(soc, (int, float)) and -10 <= econ <= 10 and -10 <= soc <= 10
    if body.get("onboarded") and ok_range and "summary" in st and "tags" in st:
        rec_pass(f"POST /api/onboarding/submit (econ={econ}, soc={soc}, tags={st.get('tags')})")
    else:
        rec_fail("Onboarding response shape", f"onboarded={body.get('onboarded')} stance={st}")
    return uid, tok


def test_verify_upload(tok):
    # 1x1 png
    png = base64.b64decode(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
    )
    files = {"file": ("id.png", io.BytesIO(png), "image/png")}
    r = requests.post(f"{BASE}/api/verify/upload", headers=h(tok), files=files, timeout=60)
    if r.status_code == 200 and r.json().get("status") == "verified":
        rec_pass("POST /api/verify/upload (MOCKED auto-approval)")
    else:
        rec_fail("verify upload", f"{r.status_code} {r.text[:300]}")


def test_matchmaking():
    # cleanup queues/rooms/pending for these test users
    import pymongo
    m = pymongo.MongoClient("mongodb://localhost:27017")
    db = m["test_database"]
    db.match_queue.delete_many({"user_id": {"$in": ["test-user-a", "test-user-b"]}})
    db.pending_rooms.delete_many({"user_id": {"$in": ["test-user-a", "test-user-b"]}})
    db.rooms.delete_many({"$or": [
        {"user_a": "test-user-a"}, {"user_b": "test-user-a"},
        {"user_a": "test-user-b"}, {"user_b": "test-user-b"},
    ]})

    r1 = requests.post(f"{BASE}/api/match/enqueue", headers=h(TOK_A), timeout=30)
    if r1.status_code != 200 or r1.json().get("matched") is not False:
        rec_fail("Enqueue A", f"{r1.status_code} {r1.text[:200]}")
        return None
    rec_pass("Enqueue A -> matched:false")

    r2 = requests.post(f"{BASE}/api/match/enqueue", headers=h(TOK_B), timeout=60)
    b = r2.json() if r2.status_code == 200 else {}
    room_id = b.get("room_id")
    if r2.status_code == 200 and b.get("matched") and room_id and isinstance(b.get("topics"), list) and "opposition_score" in b:
        rec_pass(f"Enqueue B -> matched:true room={room_id} score={b.get('opposition_score')} topics_len={len(b.get('topics') or [])}")
    else:
        rec_fail("Enqueue B", f"{r2.status_code} {r2.text[:300]}")
        return None

    r3 = requests.get(f"{BASE}/api/match/poll", headers=h(TOK_A), timeout=15)
    j3 = r3.json() if r3.status_code == 200 else {}
    if r3.status_code == 200 and j3.get("matched") and j3.get("room_id") == room_id:
        rec_pass("Poll A -> same room")
    else:
        rec_fail("Poll A", f"{r3.status_code} {r3.text[:200]}")

    return room_id


def test_room_endpoints(room_id):
    r = requests.get(f"{BASE}/api/rooms/{room_id}", headers=h(TOK_A), timeout=15)
    if r.status_code == 200:
        d = r.json()
        if d.get("room_id") == room_id and d.get("partner") and "opposition_score" in d and isinstance(d.get("topics"), list):
            rec_pass("GET /api/rooms/{id} participant")
        else:
            rec_fail("Room details shape", str(d)[:200])
    else:
        rec_fail("GET room participant", f"{r.status_code} {r.text[:200]}")

    # Non-participant: create a fresh third user
    import pymongo
    from datetime import datetime, timedelta, timezone
    m = pymongo.MongoClient("mongodb://localhost:27017")
    db = m["test_database"]
    uid = "test-nonparticipant"
    tok = "test_session_nonpart"
    db.users.delete_many({"user_id": uid})
    db.user_sessions.delete_many({"user_id": uid})
    db.users.insert_one({
        "user_id": uid, "email": "np@test.local", "name": "NP", "display_name": "NP",
        "picture": None, "bio": "", "stance": {"economic": 0, "social": 0, "summary": "", "tags": []},
        "onboarded": True, "id_verified": True, "verification_status": "verified",
        "debates": 0, "minds_changed": 0, "created_at": datetime.now(timezone.utc).isoformat(),
    })
    db.user_sessions.insert_one({
        "user_id": uid, "session_token": tok,
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    r2 = requests.get(f"{BASE}/api/rooms/{room_id}", headers=h(tok), timeout=15)
    if r2.status_code == 403:
        rec_pass("GET /api/rooms/{id} non-participant -> 403")
    else:
        rec_fail("Room 403", f"{r2.status_code} {r2.text[:200]}")


def test_feedback_and_stats(room_id):
    r = requests.post(
        f"{BASE}/api/rooms/{room_id}/feedback",
        headers=h(TOK_A),
        json={"room_id": room_id, "rating": 5, "mind_changed": True, "notes": "great debate"},
        timeout=15,
    )
    if r.status_code == 200 and r.json().get("ok"):
        rec_pass("POST /api/rooms/{id}/feedback")
    else:
        rec_fail("Feedback", f"{r.status_code} {r.text[:200]}")

    r2 = requests.get(f"{BASE}/api/dashboard/stats", headers=h(TOK_A), timeout=15)
    if r2.status_code == 200:
        d = r2.json()
        if d.get("debates") == 1 and d.get("minds_changed") == 1 and "stance" in d and "recent_feedback" in d:
            rec_pass("GET /api/dashboard/stats increments debates/minds_changed")
        else:
            rec_fail("Stats content", str(d)[:200])
    else:
        rec_fail("Stats", f"{r2.status_code} {r2.text[:200]}")


async def test_websocket(room_id):
    ws_base = BASE.replace("https://", "wss://").replace("http://", "ws://")

    # Invalid token
    try:
        async with websockets.connect(f"{ws_base}/api/ws/room/{room_id}?token=BADTOKEN") as ws:
            await ws.recv()
        rec_fail("WS invalid token", "did not close")
    except websockets.exceptions.ConnectionClosed as e:
        if e.code == 4401 or e.rcvd and e.rcvd.code == 4401:
            rec_pass("WS invalid token -> 4401")
        else:
            rec_fail("WS invalid token close code", f"{e.code}")
    except websockets.exceptions.InvalidStatusCode as e:
        rec_fail("WS invalid token", f"invalid status {e.status_code}")
    except Exception as e:
        # Some servers close before handshake completes cleanly
        msg = str(e)
        if "4401" in msg:
            rec_pass("WS invalid token -> 4401")
        else:
            rec_fail("WS invalid token", msg[:200])

    # Non-participant: create fresh session
    import pymongo
    from datetime import datetime, timedelta, timezone
    m = pymongo.MongoClient("mongodb://localhost:27017")
    db = m["test_database"]
    tok = "test_session_wsnonpart"
    db.user_sessions.delete_many({"session_token": tok})
    db.user_sessions.insert_one({
        "user_id": "test-nonparticipant", "session_token": tok,
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    try:
        async with websockets.connect(f"{ws_base}/api/ws/room/{room_id}?token={tok}") as ws:
            await ws.recv()
        rec_fail("WS non-participant", "did not close")
    except websockets.exceptions.ConnectionClosed as e:
        code = e.code or (e.rcvd.code if e.rcvd else None)
        if code == 4403:
            rec_pass("WS non-participant -> 4403")
        else:
            rec_fail("WS non-participant close code", f"{code}")
    except Exception as e:
        msg = str(e)
        if "4403" in msg:
            rec_pass("WS non-participant -> 4403")
        else:
            rec_fail("WS non-participant", msg[:200])

    # Two participants exchange signaling + chat
    try:
        ws_a = await websockets.connect(f"{ws_base}/api/ws/room/{room_id}?token={TOK_A}")
        ws_b = await websockets.connect(f"{ws_base}/api/ws/room/{room_id}?token={TOK_B}")

        # First message on each should be room-state
        msg_a1 = json.loads(await asyncio.wait_for(ws_a.recv(), timeout=5))
        msg_b1 = json.loads(await asyncio.wait_for(ws_b.recv(), timeout=5))
        got_room_state = msg_a1.get("type") == "room-state" and msg_b1.get("type") == "room-state"
        if got_room_state:
            rec_pass("WS room-state on connect")
        else:
            rec_fail("WS room-state", f"a={msg_a1} b={msg_b1}")

        # A should also get peer-joined for B (sent when B joins, after A already connected)
        # drain any pending on A
        try:
            extra = json.loads(await asyncio.wait_for(ws_a.recv(), timeout=2))
            print(f"  extra on A: {extra}")
        except asyncio.TimeoutError:
            pass

        # A sends offer to B
        await ws_a.send(json.dumps({"type": "offer", "target": "test-user-b", "sdp": "dummy"}))
        msg = json.loads(await asyncio.wait_for(ws_b.recv(), timeout=5))
        if msg.get("type") == "offer" and msg.get("from") == "test-user-a" and msg.get("sdp") == "dummy":
            rec_pass("WS signaling offer routed with `from` field")
        else:
            rec_fail("WS signaling", str(msg)[:200])

        # A sends chat
        await ws_a.send(json.dumps({"type": "chat", "text": "hello opposing side"}))
        # both should receive
        recv_a = json.loads(await asyncio.wait_for(ws_a.recv(), timeout=5))
        recv_b = json.loads(await asyncio.wait_for(ws_b.recv(), timeout=5))
        if recv_a.get("type") == "chat" and recv_b.get("type") == "chat" and recv_a.get("text") == "hello opposing side":
            rec_pass("WS chat broadcast to both")
        else:
            rec_fail("WS chat", f"a={recv_a} b={recv_b}")

        await ws_a.close()
        await ws_b.close()
    except Exception as e:
        rec_fail("WS two-participant exchange", str(e)[:300])


def main():
    test_root()
    test_questions()
    test_auth_missing()
    test_auth_me()
    test_ws_ticket()
    _, ob_tok = test_onboarding_submit()
    if ob_tok:
        test_verify_upload(ob_tok)
    room_id = test_matchmaking()
    if room_id:
        test_room_endpoints(room_id)
        asyncio.run(test_websocket(room_id))
        test_feedback_and_stats(room_id)

    print("\n===== SUMMARY =====")
    print(f"PASSED: {len(results['passed'])}")
    print(f"FAILED: {len(results['failed'])}")
    for f in results["failed"]:
        print(f"  - {f['area']}: {f['evidence']}")

    with open("/app/test_reports/backend_raw_results.json", "w") as f:
        json.dump(results, f, indent=2)


if __name__ == "__main__":
    main()
