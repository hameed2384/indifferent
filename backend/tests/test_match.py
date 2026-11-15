"""Matchmaking: the core loop of the app (two people who disagree get paired)."""
from app.db import db
from app.routers.match import _avg_tag_positions
from app.topic_stances import shared_tag_opposition


# --- pure scoring helpers -------------------------------------------------

def _pos(**tags):
    return {t: {"position": p, "summary": ""} for t, p in tags.items()}


def test_opposition_picks_most_opposed_shared_tag():
    a = _pos(cats=8, dogs=1, tax=0)
    b = _pos(cats=-8, dogs=0)
    assert shared_tag_opposition(a, b) == ("cats", 16)


def test_opposition_none_without_shared_tag():
    assert shared_tag_opposition(_pos(cats=5), _pos(dogs=-5)) is None


def test_party_average_keeps_only_common_tags():
    avg = _avg_tag_positions([_pos(cats=4, dogs=2), _pos(cats=-2)])
    assert set(avg) == {"cats"}
    assert avg["cats"]["position"] == 1


# --- /match/enqueue gatekeeping -------------------------------------------

async def test_enqueue_requires_xhr_header(client, ready_user):
    _, headers = await ready_user({"cats": 5})
    r = await client.post("/api/match/enqueue", headers={**headers, "X-Requested-With": ""})
    assert r.status_code == 403


async def test_enqueue_requires_onboarding(client, make_user):
    _, headers = await make_user(id_verified=True)
    r = await client.post("/api/match/enqueue", headers=headers)
    assert r.status_code == 400
    assert "onboarding" in r.json()["detail"].lower()


async def test_enqueue_requires_verification(client, make_user):
    _, headers = await make_user(onboarded=True, interest_tags=["cats"])
    r = await client.post("/api/match/enqueue", headers=headers)
    assert r.status_code == 400
    assert "verification" in r.json()["detail"].lower()


async def test_enqueue_requires_interest_tags(client, make_user):
    _, headers = await make_user(onboarded=True, id_verified=True)
    r = await client.post("/api/match/enqueue", headers=headers)
    assert r.status_code == 400


# --- matching flow ----------------------------------------------------------

async def test_first_user_waits_in_queue(client, ready_user):
    user, headers = await ready_user({"cats": 7})
    r = await client.post("/api/match/enqueue", headers=headers)
    assert r.json() == {"matched": False}
    assert await db.match_queue.find_one({"user_id": user["user_id"]})


async def test_opposing_users_get_matched(client, ready_user):
    a, a_headers = await ready_user({"cats": 8})
    b, b_headers = await ready_user({"cats": -6})

    assert (await client.post("/api/match/enqueue", headers=a_headers)).json()["matched"] is False
    r = await client.post("/api/match/enqueue", headers=b_headers)
    body = r.json()
    assert body["matched"] is True
    assert body["category"] == "cats"
    assert body["opposition_score"] == 14
    assert len(body["topics"]) == 3  # canned fallback prompts (no Groq key in tests)

    room = await db.rooms.find_one({"room_id": body["room_id"]})
    assert set(room["founding_members"]) == {a["user_id"], b["user_id"]}
    assert await db.match_queue.count_documents({}) == 0

    # The waiting user finds out on their next poll, exactly once.
    poll = (await client.get("/api/match/poll", headers=a_headers)).json()
    assert poll["matched"] is True and poll["room_id"] == body["room_id"]
    assert (await client.get("/api/match/poll", headers=a_headers)).json() == {"matched": False}


async def test_no_match_without_shared_tag(client, ready_user):
    _, a_headers = await ready_user({"cats": 8})
    _, b_headers = await ready_user({"dogs": -8})
    await client.post("/api/match/enqueue", headers=a_headers)
    r = await client.post("/api/match/enqueue", headers=b_headers)
    assert r.json() == {"matched": False}
    assert await db.match_queue.count_documents({}) == 2


async def _put_in_queue(user, positions):
    # Inserted directly: queueing the second via /match/enqueue would just
    # match it against the first (any shared tag matches — see below).
    await db.match_queue.insert_one({
        "user_id": user["user_id"],
        "tag_positions": {t: {"position": p, "summary": ""} for t, p in positions.items()},
        "display_name": user["name"],
        "joined_at": "2026-01-01T00:00:00+00:00",
    })


async def test_most_opposed_candidate_wins(client, ready_user):
    mild, _ = await ready_user({"cats": 2})
    strong, _ = await ready_user({"cats": 9})
    _, me_h = await ready_user({"cats": -9})
    await _put_in_queue(mild, {"cats": 2})
    await _put_in_queue(strong, {"cats": 9})

    body = (await client.post("/api/match/enqueue", headers=me_h)).json()
    room = await db.rooms.find_one({"room_id": body["room_id"]})
    assert room["user_b"] == strong["user_id"]
    assert await db.match_queue.find_one({"user_id": mild["user_id"]})


async def test_users_who_agree_still_get_matched(client, ready_user):
    """Documents current behaviour: there is no minimum opposition score, so
    two people with the SAME stance on a shared tag are paired (score 0).
    Change this test if a threshold is introduced."""
    _, a_h = await ready_user({"cats": 5})
    _, b_h = await ready_user({"cats": 5})
    await client.post("/api/match/enqueue", headers=a_h)
    body = (await client.post("/api/match/enqueue", headers=b_h)).json()
    assert body["matched"] is True
    assert body["opposition_score"] == 0


async def test_cancel_leaves_queue(client, ready_user):
    user, headers = await ready_user({"cats": 3})
    await client.post("/api/match/enqueue", headers=headers)
    r = await client.post("/api/match/cancel", headers=headers)
    assert r.json() == {"ok": True}
    assert await db.match_queue.find_one({"user_id": user["user_id"]}) is None
