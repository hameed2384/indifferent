"""AI sparring: debate an AI that takes the opposite side, then get feedback.

Groq is off in tests, so these exercise the canned fallbacks; one test stubs
the LLM to check the real-response path (reply + normalized feedback)."""
import pytest

import app.routers.spar as spar
from app.db import db


async def _start(client, headers, **body):
    return await client.post("/api/spar/start", json=body, headers=headers)


async def test_requires_onboarding(client, make_user):
    _, headers = await make_user()
    r = await _start(client, headers)
    assert r.status_code == 400


async def test_does_not_require_id_verification(client, make_user):
    _, headers = await make_user(onboarded=True, interest_tags=["cats"], stances={"cats": 6})
    r = await _start(client, headers)
    assert r.status_code == 200


async def test_start_takes_opposite_of_strongest_stance(client, make_user):
    _, headers = await make_user(onboarded=True, interest_tags=["cats", "tax"], stances={"cats": 2.5, "tax": -8})
    body = (await _start(client, headers)).json()
    assert body["tag"] == "tax"
    assert body["user_position"] == -8 and body["ai_position"] == 8
    assert body["status"] == "active"
    assert body["messages"][0]["role"] == "ai" and body["messages"][0]["text"]


async def test_fence_sitter_still_gets_a_real_opponent(client, make_user):
    _, headers = await make_user(onboarded=True, interest_tags=["cats"], stances={"cats": 0.5})
    body = (await _start(client, headers)).json()
    assert abs(body["ai_position"]) >= 6


async def test_explicit_tag_must_be_users_own(client, make_user):
    _, headers = await make_user(onboarded=True, interest_tags=["cats"], stances={"cats": 5})
    assert (await _start(client, headers, tag="dogs")).status_code == 400
    assert (await _start(client, headers, tag="cats")).json()["tag"] == "cats"


async def test_start_leaves_human_queue(client, make_user):
    user, headers = await make_user(onboarded=True, interest_tags=["cats"], stances={"cats": 5})
    await db.match_queue.insert_one({"user_id": user["user_id"], "tag_positions": {}})
    await _start(client, headers)
    assert await db.match_queue.count_documents({}) == 0


async def test_message_gets_ai_reply_and_counts_turns(client, make_user):
    _, headers = await make_user(onboarded=True, interest_tags=["cats"], stances={"cats": 5})
    debate = (await _start(client, headers)).json()
    r = await client.post(f"/api/spar/{debate['debate_id']}/message", json={"text": "Cats are great."}, headers=headers)
    body = r.json()
    assert [m["role"] for m in body["messages"]] == ["user", "ai"]
    assert body["user_turns"] == 1 and body["turns_left"] == spar.MAX_USER_TURNS - 1

    full = (await client.get(f"/api/spar/{debate['debate_id']}", headers=headers)).json()
    assert [m["role"] for m in full["messages"]] == ["ai", "user", "ai"]


async def test_turn_limit(client, make_user, monkeypatch):
    monkeypatch.setattr(spar, "MAX_USER_TURNS", 1)
    _, headers = await make_user(onboarded=True, interest_tags=["cats"], stances={"cats": 5})
    did = (await _start(client, headers)).json()["debate_id"]
    assert (await client.post(f"/api/spar/{did}/message", json={"text": "one"}, headers=headers)).status_code == 200
    r = await client.post(f"/api/spar/{did}/message", json={"text": "two"}, headers=headers)
    assert r.status_code == 400


async def test_other_users_cannot_see_or_post(client, make_user):
    _, owner = await make_user(onboarded=True, interest_tags=["cats"], stances={"cats": 5})
    _, stranger = await make_user(onboarded=True, interest_tags=["cats"], stances={"cats": -5})
    did = (await _start(client, owner)).json()["debate_id"]
    assert (await client.get(f"/api/spar/{did}", headers=stranger)).status_code == 404
    assert (await client.post(f"/api/spar/{did}/message", json={"text": "hi"}, headers=stranger)).status_code == 404


async def test_end_gives_feedback_and_bumps_streak(client, make_user):
    user, headers = await make_user(onboarded=True, interest_tags=["cats"], stances={"cats": 5})
    did = (await _start(client, headers)).json()["debate_id"]
    await client.post(f"/api/spar/{did}/message", json={"text": "Cats are independent."}, headers=headers)
    body = (await client.post(f"/api/spar/{did}/end", headers=headers)).json()
    assert body["status"] == "ended"
    assert body["feedback"]["fallback"] is True  # no Groq in tests
    assert (await db.users.find_one({"user_id": user["user_id"]}))["streak_count"] == 1

    r = await client.post(f"/api/spar/{did}/message", json={"text": "more"}, headers=headers)
    assert r.status_code == 400


async def test_ending_without_arguing_gives_no_feedback(client, make_user):
    _, headers = await make_user(onboarded=True, interest_tags=["cats"], stances={"cats": 5})
    did = (await _start(client, headers)).json()["debate_id"]
    body = (await client.post(f"/api/spar/{did}/end", headers=headers)).json()
    assert body["status"] == "ended" and body["feedback"] is None


async def test_real_llm_path_reply_and_normalized_feedback(client, make_user, monkeypatch):
    async def fake_llm(system, prompt, session_id=None):
        if "debate coach" in system:
            return {"scores": {"clarity": 11, "evidence": "7", "rebuttal": None, "civility": 9.4},
                    "summary": "Solid.", "strengths": ["a", "b", "c", "d"], "improvements": ["x"],
                    "fallacies": [], "best_line": "Cats are independent."}
        return {"reply": "Dogs are more loyal."}

    monkeypatch.setattr(spar, "call_llm_json", fake_llm)
    _, headers = await make_user(onboarded=True, interest_tags=["cats"], stances={"cats": 5})
    debate = (await _start(client, headers)).json()
    assert debate["messages"][0]["text"] == "Dogs are more loyal."
    did = debate["debate_id"]
    await client.post(f"/api/spar/{did}/message", json={"text": "Cats are independent."}, headers=headers)
    fb = (await client.post(f"/api/spar/{did}/end", headers=headers)).json()["feedback"]
    assert fb["scores"] == {"clarity": 10, "evidence": 7, "rebuttal": 5, "civility": 9}
    assert len(fb["strengths"]) == 3 and fb["fallback"] is False


async def test_history_lists_own_debates(client, make_user):
    _, headers = await make_user(onboarded=True, interest_tags=["cats", "tax"], stances={"cats": 5, "tax": -3})
    await _start(client, headers, tag="cats")
    await _start(client, headers, tag="tax")
    body = (await client.get("/api/spar", headers=headers)).json()
    assert len(body["debates"]) == 2


async def test_restart_reuses_untouched_round(client, make_user):
    _, headers = await make_user(onboarded=True, interest_tags=["cats"], stances={"cats": 5})
    first = (await _start(client, headers)).json()
    again = (await _start(client, headers)).json()
    assert again["debate_id"] == first["debate_id"]
    assert len(again["messages"]) == 1

    # Once the user has argued, a new start is a fresh round.
    await client.post(f"/api/spar/{first['debate_id']}/message", json={"text": "hi"}, headers=headers)
    fresh = (await _start(client, headers)).json()
    assert fresh["debate_id"] != first["debate_id"]
