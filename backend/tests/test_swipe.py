"""Swipe (GET /public/swipe/takes, POST /public/swipe/vote): anonymous agree/disagree counters per take."""
from app.motions import MOTIONS
from app.routers import swipe
from app.swipe_takes import SWIPE_TAKES


def fresh():
    swipe._cache["at"] = 0.0  # the takes list is cached for a minute; tests want the live numbers


async def test_catalog_has_motions_and_takes(client):
    fresh()
    takes = (await client.get("/api/public/swipe/takes")).json()["takes"]
    assert len(takes) == len(MOTIONS) + len(SWIPE_TAKES)
    ids = [t["id"] for t in takes]
    assert len(ids) == len(set(ids))
    assert all(t["text"] and t["tag"] and t["votes"] == [0, 0] for t in takes)
    assert takes[0]["slug"] == MOTIONS[0]["slug"]  # motions link to their debate page


async def test_votes_count_and_show_up_in_the_list(client):
    tid = SWIPE_TAKES[0]["id"]
    r = await client.post("/api/public/swipe/vote", json={"id": tid, "v": 1})
    assert r.status_code == 200 and r.json() == {"id": tid, "agree": 1, "disagree": 0}
    await client.post("/api/public/swipe/vote", json={"id": tid, "v": 1})
    r = await client.post("/api/public/swipe/vote", json={"id": tid, "v": -1})
    assert r.json() == {"id": tid, "agree": 2, "disagree": 1}
    fresh()
    takes = {t["id"]: t for t in (await client.get("/api/public/swipe/takes")).json()["takes"]}
    assert takes[tid]["votes"] == [2, 1]


async def test_rejects_unknown_takes_and_bad_votes(client):
    assert (await client.post("/api/public/swipe/vote", json={"id": "nope", "v": 1})).status_code == 404
    tid = SWIPE_TAKES[0]["id"]
    assert (await client.post("/api/public/swipe/vote", json={"id": tid, "v": 0})).status_code == 422
    assert (await client.post("/api/public/swipe/vote", json={"id": tid, "v": "1"})).status_code == 422


def test_takes_are_clean():
    for t in SWIPE_TAKES:
        low = t["text"].lower()
        assert "agree or disagree" not in low and "pick a side" not in low
        assert "fuck" not in low and "shit" not in low  # swearing only ever censored
