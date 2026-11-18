"""The Arena's anonymous votes (GET /public/arena/{slug}, POST .../vote)."""
from app.db import db
from app.motions import MOTIONS

SLUG = MOTIONS[0]["slug"]
VOTER = "voter-aaaaaaaaaaaaaaaa"


async def vote(client, side="for", voter=VOTER, slug=SLUG):
    return await client.post(f"/api/public/arena/{slug}/vote", json={"side": side, "voter_id": voter})


async def test_motion_starts_with_no_votes(client):
    r = await client.get(f"/api/public/arena/{SLUG}")
    assert r.status_code == 200
    d = r.json()
    assert d["motion"] == MOTIONS[0]["motion"]
    assert (d["votes_for"], d["votes_against"]) == (0, 0)


async def test_each_voter_counts_once_and_can_change_side(client):
    assert (await vote(client)).json()["votes_for"] == 1
    assert (await vote(client)).json()["votes_for"] == 1
    d = (await vote(client, "against")).json()
    assert (d["votes_for"], d["votes_against"], d["my_side"]) == (0, 1, "against")
    d = (await vote(client, "for", "voter-bbbbbbbbbbbbbbbb")).json()
    assert (d["votes_for"], d["votes_against"]) == (1, 1)


async def test_votes_are_separate_per_motion(client):
    await vote(client)
    other = MOTIONS[1]["slug"]
    assert (await client.get(f"/api/public/arena/{other}")).json()["votes_for"] == 0


async def test_raw_voter_id_is_not_stored(client):
    await vote(client)
    doc = await db.arena_votes.find_one({})
    assert VOTER not in str(doc)


async def test_bad_requests_are_rejected(client):
    assert (await vote(client, "maybe")).status_code == 422
    assert (await vote(client, voter="short")).status_code == 422
    assert (await vote(client, slug="not-a-motion")).status_code == 404
    assert (await client.get("/api/public/arena/not-a-motion")).status_code == 404


async def test_vote_flood_is_rate_limited(client):
    codes = [(await vote(client, voter=f"voter-{i:020d}")).status_code for i in range(31)]
    assert codes[:30] == [200] * 30 and codes[30] == 429
