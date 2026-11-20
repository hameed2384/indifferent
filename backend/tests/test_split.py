"""The Split Test (POST /public/split, GET .../{code}, POST .../respond, GET .../results)."""
from app.db import db
from app.motions import MOTIONS

SLUGS = [m["slug"] for m in MOTIONS[:12]]
A = ["for"] * 6 + ["against"] * 6
B = ["for"] * 12


async def make(client, name="Sam", slugs=SLUGS, answers=A):
    return await client.post("/api/public/split", json={"name": name, "slugs": slugs, "answers": answers})


async def test_create_and_open(client):
    r = await make(client)
    assert r.status_code == 200
    code, key = r.json()["code"], r.json()["key"]
    d = (await client.get(f"/api/public/split/{code}")).json()
    assert d["name"] == "Sam" and d["responses"] == 0
    assert [q["slug"] for q in d["deck"]] == SLUGS
    assert "answers" not in d  # a friend can't peek before answering
    doc = await db.split_tests.find_one({"code": code})
    assert key not in str(doc)


async def test_friend_sees_both_sets_of_answers_after_answering(client):
    code = (await make(client)).json()["code"]
    r = await client.post(f"/api/public/split/{code}/respond", json={"name": "Alex", "answers": B})
    assert r.status_code == 200
    d = r.json()
    assert d["answers"] == A and d["me"]["answers"] == B and d["me"]["name"] == "Alex"
    assert (await client.get(f"/api/public/split/{code}")).json()["responses"] == 1


async def test_only_the_creator_sees_everyone(client):
    made = (await make(client)).json()
    code, key = made["code"], made["key"]
    for name in ("Alex", "Jo"):
        await client.post(f"/api/public/split/{code}/respond", json={"name": name, "answers": B})
    assert (await client.get(f"/api/public/split/{code}/results")).status_code == 403
    assert (await client.get(f"/api/public/split/{code}/results", params={"key": "wrong-key-123"})).status_code == 403
    d = (await client.get(f"/api/public/split/{code}/results", params={"key": key})).json()
    assert [r["name"] for r in d["responses"]] == ["Jo", "Alex"]  # newest first
    assert d["answers"] == A


async def test_names_are_cleaned(client):
    code = (await make(client, name="  <b>Sam</b>\n  the   great  ")).json()["code"]
    assert (await client.get(f"/api/public/split/{code}")).json()["name"] == "bSam/b the great"
    assert (await make(client, name="   ")).status_code == 422


async def test_bad_requests_are_rejected(client):
    assert (await make(client, slugs=SLUGS[:11], answers=A[:11])).status_code == 422
    assert (await make(client, slugs=[SLUGS[0]] * 12)).status_code == 422
    assert (await make(client, slugs=SLUGS[:11] + ["not-a-motion"])).status_code == 422
    assert (await make(client, answers=["maybe"] * 12)).status_code == 422
    assert (await client.get("/api/public/split/nope!")).status_code == 404
    assert (await client.get("/api/public/split/abcdefgh")).status_code == 404
    code = (await make(client)).json()["code"]
    bad = await client.post(f"/api/public/split/{code}/respond", json={"name": "Alex", "answers": B[:5]})
    assert bad.status_code == 422


async def test_creating_is_rate_limited(client):
    codes = [(await make(client)).status_code for _ in range(11)]
    assert codes[:10] == [200] * 10 and codes[10] == 429


async def test_five_point_answers(client):
    scale = [2, 1, 0, -1, -2, 2, 1, 0, -1, -2, 2, 1]
    code = (await make(client, answers=scale)).json()["code"]
    r = await client.post(f"/api/public/split/{code}/respond", json={"name": "Alex", "answers": [-2] * 12})
    assert r.status_code == 200 and r.json()["answers"] == scale
    assert (await make(client, answers=[3] * 12)).status_code == 422
    assert (await make(client, answers=[True] * 12)).status_code == 422
