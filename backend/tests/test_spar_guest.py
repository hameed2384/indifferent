"""Guest sparring: a visitor debates a curated motion without signing up,
can only reach their own round via the guest token, and can claim it into
an account after signing in."""
import app.routers.spar as spar
from app.db import db


async def _guest_start(client, motion_id="remote-work", side="for"):
    client.headers.pop("Authorization", None)
    return await client.post("/api/spar/guest/start", json={"motion_id": motion_id, "side": side})


async def test_motions_list_is_public(client):
    body = (await client.get("/api/spar/guest/motions")).json()
    assert len(body["motions"]) >= 5 and body["max_turns"] == spar.MAX_GUEST_TURNS


async def test_guest_start_without_account(client):
    r = await _guest_start(client, side="against")
    assert r.status_code == 200
    body = r.json()
    assert body["guest"] is True and body["guest_token"]
    assert body["topic"] == "Remote work is better than working in an office"
    assert body["user_position"] == -7 and body["ai_position"] == 7
    assert body["max_user_turns"] == spar.MAX_GUEST_TURNS
    assert body["messages"][0]["role"] == "ai"


async def test_guest_start_validates_input(client):
    assert (await _guest_start(client, motion_id="nope")).status_code == 400
    assert (await _guest_start(client, side="maybe")).status_code == 400


async def test_guest_can_play_full_round_with_token(client):
    body = (await _guest_start(client)).json()
    did, tok = body["debate_id"], body["guest_token"]
    g = {"X-Guest-Token": tok}
    r = await client.post(f"/api/spar/{did}/message", json={"text": "Commutes waste hours."}, headers=g)
    assert r.status_code == 200 and r.json()["turns_left"] == spar.MAX_GUEST_TURNS - 1
    assert (await client.get(f"/api/spar/{did}", headers=g)).json()["status"] == "active"
    ended = (await client.post(f"/api/spar/{did}/end", headers=g)).json()
    assert ended["status"] == "ended" and ended["feedback"] is not None


async def test_guest_round_needs_its_own_token(client):
    did = (await _guest_start(client)).json()["debate_id"]
    other = (await _guest_start(client)).json()["guest_token"]
    assert (await client.get(f"/api/spar/{did}")).status_code == 401
    assert (await client.get(f"/api/spar/{did}", headers={"X-Guest-Token": other})).status_code == 404
    assert (await client.get(f"/api/spar/{did}", headers={"X-Guest-Token": "short"})).status_code == 401


async def test_guest_turn_cap(client, monkeypatch):
    monkeypatch.setattr(spar, "MAX_GUEST_TURNS", 1)
    body = (await _guest_start(client)).json()
    g = {"X-Guest-Token": body["guest_token"]}
    assert (await client.post(f"/api/spar/{body['debate_id']}/message", json={"text": "a"}, headers=g)).status_code == 200
    assert (await client.post(f"/api/spar/{body['debate_id']}/message", json={"text": "b"}, headers=g)).status_code == 400


async def test_guest_start_rate_limited_per_ip(client):
    codes = [(await _guest_start(client)).status_code for _ in range(6)]
    assert codes[:5] == [200] * 5 and codes[5] == 429


async def test_claim_moves_round_into_account(client, make_user):
    body = (await _guest_start(client)).json()
    did, tok = body["debate_id"], body["guest_token"]
    await client.post(f"/api/spar/{did}/message", json={"text": "x"}, headers={"X-Guest-Token": tok})
    await client.post(f"/api/spar/{did}/end", headers={"X-Guest-Token": tok})

    user, headers = await make_user()
    r = await client.post(f"/api/spar/{did}/claim", headers={**headers, "X-Guest-Token": tok})
    assert r.status_code == 200
    assert (await db.ai_debates.find_one({"debate_id": did}))["user_id"] == user["user_id"]
    assert (await client.get(f"/api/spar/{did}", headers=headers)).status_code == 200
    # The guest token no longer reaches it.
    client.headers.pop("Authorization", None)
    assert (await client.get(f"/api/spar/{did}", headers={"X-Guest-Token": tok})).status_code == 404
    listed = (await client.get("/api/spar", headers=headers)).json()["debates"]
    assert [d["debate_id"] for d in listed] == [did]


async def test_claim_requires_matching_token(client, make_user):
    did = (await _guest_start(client)).json()["debate_id"]
    _, headers = await make_user()
    r = await client.post(f"/api/spar/{did}/claim", headers={**headers, "X-Guest-Token": "x" * 32})
    assert r.status_code == 404


async def test_ai_is_told_its_side_plainly_when_user_disagrees(client, monkeypatch):
    """Regression: with "I disagree", the model sometimes took the user's side
    in its opening because of the double negative."""
    import app.routers.spar as spar
    prompts = []
    async def capture(system, user, **kw):
        prompts.append(system)
        return {"reply": "ok"}
    monkeypatch.setattr(spar, "call_llm_json", capture)
    r = await client.post("/api/spar/guest/start", json={"motion_id": "straw-holes", "side": "against"},
                          headers={"X-Requested-With": "XMLHttpRequest"})
    assert r.status_code == 200, r.text
    assert 'the statement "A straw has one hole" is TRUE' in prompts[0]

    prompts.clear()
    r = await client.post("/api/spar/guest/start", json={"motion_id": "straw-holes", "side": "for"},
                          headers={"X-Requested-With": "XMLHttpRequest"})
    assert 'the statement "A straw has one hole" is FALSE' in prompts[0]
