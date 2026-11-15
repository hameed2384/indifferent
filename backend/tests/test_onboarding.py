"""Onboarding submit: requires the 18+/Terms confirmation and maps stances."""
from app.db import db

PAYLOAD = {
    "tags": ["Technology"],
    "questions": [],
    "quiz_answers": {},
    "free_text": "I think technology mostly makes life better for people.",
    "display_name": "Tester",
}


async def test_requires_terms_and_age_confirmation(client, make_user):
    user, headers = await make_user()
    r = await client.post("/api/onboarding/submit", json=PAYLOAD, headers=headers)
    assert r.status_code == 400 and "18+" in r.json()["detail"]
    assert not (await db.users.find_one({"user_id": user["user_id"]})).get("onboarded")


async def test_accepting_terms_completes_onboarding(client, make_user):
    user, headers = await make_user()
    r = await client.post("/api/onboarding/submit", json={**PAYLOAD, "accepted_terms": True}, headers=headers)
    assert r.status_code == 200
    doc = await db.users.find_one({"user_id": user["user_id"]})
    assert doc["onboarded"] and doc["age_confirmed"] and doc["terms_accepted_at"]
    assert doc["interest_tags"] == ["Technology"]
    assert await db.topic_stances.find_one({"user_id": user["user_id"], "topic": "Technology"})


async def test_spar_hides_placeholder_stance_summary(client, make_user):
    _, headers = await make_user(onboarded=True, interest_tags=["cats"], stances={"cats": 5})
    await db.topic_stances.update_many({}, {"$set": {"summary": "Stance derived from quiz answers."}})
    body = (await client.post("/api/spar/start", json={}, headers=headers)).json()
    assert body["user_view"] == ""
    assert "Stance derived" not in body["messages"][0]["text"]
