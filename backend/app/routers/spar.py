"""AI sparring — text debates against an AI that argues the opposite of the
user's own stance on one of their interest tags.

Why this exists: matchmaking needs two humans with opposing views online at
the same moment, which a young app rarely has, so the first thing most
visitors saw was an endless "Finding your opposite" screen. Sparring gives
every onboarded user a real debate within seconds, plus a post-debate
feedback report (scores, strengths, what to improve, fallacies) that makes
the practice worth something on its own.

Deliberately separate from rooms (own collections: ai_debates,
ai_debate_messages) so none of the human-debate machinery — public feed,
recordings, voting, kick votes, LiveKit — can ever pick these up. No ID
verification needed: nobody else is involved.

Every LLM call degrades to canned text when Groq is unavailable, so the
feature never dead-ends (same convention as llm.py).
"""
import random
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from ..db import db
from ..deps import get_current_user, require_xhr
from ..llm import call_llm_json, generate_topics
from ..models import User
from ..ratelimit import rate_limit
from ..streaks import bump_streak
from ..topic_stances import get_tag_positions

router = APIRouter()

MAX_USER_TURNS = 12
MAX_MESSAGE = 800
MIN_TURNS_FOR_FEEDBACK = 1

FALLBACK_REPLIES = [
    "That's a claim, not yet an argument. What's the strongest evidence that it's actually true?",
    "Suppose you're right about that — why should it outweigh the costs on the other side?",
    "I'd push back: the people who disagree with you aren't ignoring that point, they weigh it differently. Why is your weighting the right one?",
    "Give me a concrete example. Abstractions are easy to agree with and hard to test.",
    "What would change your mind here? If nothing could, that's worth noticing.",
]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _ai_position(user_position: float) -> float:
    """The opposite side. A user sitting near the middle still gets a clear
    opponent rather than another fence-sitter."""
    if abs(user_position) < 2:
        return 7.0 if user_position <= 0 else -7.0
    return -user_position


def _side_label(position: float) -> str:
    strength = "strongly " if abs(position) >= 6 else ""
    return f"{strength}{'for' if position > 0 else 'against'}"


def _system_prompt(debate: dict) -> str:
    return (
        "You are a sharp, fair debate sparring partner on a debate-practice app. "
        f"The topic: \"{debate['topic']}\" (area: {debate['tag']}). "
        f"The user's view: {debate.get('user_summary') or 'not stated'} "
        f"(position {debate['user_position']} on a -10..10 scale). "
        f"You argue the OPPOSITE side (position {debate['ai_position']}). "
        "Rules: stay on your side; be civil and specific; attack arguments, never the person; "
        "use concrete examples and reasoning; point out weak logic plainly; ask at most one "
        "pointed question per reply; concede small points when they're genuinely good, but "
        "don't switch sides. Keep each reply under 110 words, plain text, no lists, no markdown. "
        'Return ONLY JSON: {"reply": "<your reply>"}'
    )


async def _messages(debate_id: str) -> list:
    return await db.ai_debate_messages.find({"debate_id": debate_id}, {"_id": 0}).sort("created_at", 1).to_list(200)


def _transcript(messages: list) -> str:
    return "\n".join(f"{'USER' if m['role'] == 'user' else 'YOU'}: {m['text']}" for m in messages)


async def _add_message(debate_id: str, role: str, text: str) -> dict:
    msg = {"debate_id": debate_id, "role": role, "text": text, "created_at": _now()}
    await db.ai_debate_messages.insert_one(dict(msg))
    return msg


def _public(debate: dict, messages: Optional[list] = None) -> dict:
    out = {k: debate.get(k) for k in (
        "debate_id", "tag", "topic", "user_position", "ai_position", "status",
        "user_turns", "created_at", "ended_at", "feedback",
    )}
    out["max_user_turns"] = MAX_USER_TURNS
    out["user_side"] = _side_label(debate["user_position"])
    out["ai_side"] = _side_label(debate["ai_position"])
    # The user's own onboarding stance in words — a clearer way to show the
    # two sides than "for/against" when the generated topic is a question.
    out["user_view"] = debate.get("user_summary") or ""
    if messages is not None:
        out["messages"] = [{"role": m["role"], "text": m["text"], "created_at": m["created_at"]} for m in messages]
    return out


async def _owned_debate(debate_id: str, user: User) -> dict:
    debate = await db.ai_debates.find_one({"debate_id": debate_id}, {"_id": 0})
    if not debate or debate["user_id"] != user.user_id:
        raise HTTPException(status_code=404, detail="Debate not found")
    return debate


class SparStart(BaseModel):
    tag: Optional[str] = None


@router.post("/spar/start")
async def start_spar(
    payload: SparStart,
    user: User = Depends(get_current_user),
    _rl: None = Depends(rate_limit("spar_start", limit=10, window_seconds=3600)),
):
    if not user.onboarded or not user.interest_tags:
        raise HTTPException(status_code=400, detail="Complete onboarding first")
    positions = await get_tag_positions(user.user_id, user.interest_tags)
    if not positions:
        raise HTTPException(status_code=400, detail="Complete the updated onboarding to start sparring")

    if payload.tag:
        if payload.tag not in positions:
            raise HTTPException(status_code=400, detail="Pick one of your own topics")
        tag = payload.tag
    else:
        # Where the user feels strongest makes the liveliest debate.
        tag = max(positions, key=lambda t: abs(positions[t]["position"]))

    # Leaving the human queue: a spar and a pending human match would collide.
    await db.match_queue.delete_one({"user_id": user.user_id})

    mine = positions[tag]
    ai_pos = _ai_position(mine["position"])
    topics = await generate_topics(tag, mine, {"position": ai_pos, "summary": "the opposing view"})
    topic = (topics or [f"Is the direction {tag} is heading in a good one?"])[0]

    debate = {
        "debate_id": f"spar_{uuid.uuid4().hex[:12]}",
        "user_id": user.user_id,
        "tag": tag,
        "topic": topic,
        "user_position": mine["position"],
        "user_summary": mine.get("summary", ""),
        "ai_position": ai_pos,
        "status": "active",
        "user_turns": 0,
        "created_at": _now(),
    }
    await db.ai_debates.insert_one(dict(debate))

    data = await call_llm_json(
        _system_prompt(debate),
        "Open the debate: state your position on the topic in 2-3 sentences with your single "
        "strongest reason, then invite the user to make their case.",
        session_id=debate["debate_id"],
    )
    view = mine.get("summary")
    opening = (data or {}).get("reply") or (
        (f"You say: \"{view}\". I disagree, and I think the case against that is stronger than people assume. "
         if view else f"On \"{topic}\", I'm taking the side you don't. ")
        + "Make your best argument and I'll test it."
    )
    msg = await _add_message(debate["debate_id"], "ai", opening.strip()[:1200])
    return _public(debate, [msg])


@router.get("/spar")
async def list_spars(user: User = Depends(get_current_user)):
    docs = await db.ai_debates.find({"user_id": user.user_id}, {"_id": 0}).sort("created_at", -1).to_list(30)
    return {"debates": [_public(d) for d in docs]}


@router.get("/spar/{debate_id}")
async def get_spar(debate_id: str, user: User = Depends(get_current_user)):
    debate = await _owned_debate(debate_id, user)
    return _public(debate, await _messages(debate_id))


class SparMessage(BaseModel):
    text: str


@router.post("/spar/{debate_id}/message")
async def send_spar_message(
    debate_id: str,
    payload: SparMessage,
    user: User = Depends(get_current_user),
    _rl: None = Depends(rate_limit("spar_message", limit=20, window_seconds=60)),
):
    debate = await _owned_debate(debate_id, user)
    if debate["status"] != "active":
        raise HTTPException(status_code=400, detail="This debate has ended")
    if debate.get("user_turns", 0) >= MAX_USER_TURNS:
        raise HTTPException(status_code=400, detail="Turn limit reached — end the debate to get your feedback")
    text = payload.text.strip()[:MAX_MESSAGE]
    if not text:
        raise HTTPException(status_code=400, detail="Empty message")

    user_msg = await _add_message(debate_id, "user", text)
    await db.ai_debates.update_one({"debate_id": debate_id}, {"$inc": {"user_turns": 1}})
    history = await _messages(debate_id)

    data = await call_llm_json(
        _system_prompt(debate),
        f"Debate so far:\n{_transcript(history[-16:])}\n\nWrite your next reply to the USER's last message.",
        session_id=debate_id,
    )
    reply = (data or {}).get("reply") or random.choice(FALLBACK_REPLIES)
    ai_msg = await _add_message(debate_id, "ai", reply.strip()[:1200])
    turns = debate.get("user_turns", 0) + 1
    return {
        "messages": [
            {"role": m["role"], "text": m["text"], "created_at": m["created_at"]} for m in (user_msg, ai_msg)
        ],
        "user_turns": turns,
        "turns_left": max(0, MAX_USER_TURNS - turns),
    }


FEEDBACK_SYSTEM = (
    "You are an expert debate coach reviewing a practice debate between a USER and an AI "
    "sparring partner (YOU). Assess ONLY the USER's performance, honestly but encouragingly. "
    'Return ONLY JSON: {"scores": {"clarity": <1-10>, "evidence": <1-10>, "rebuttal": <1-10>, '
    '"civility": <1-10>}, "summary": "<2 sentences>", "strengths": ["<up to 3 short points>"], '
    '"improvements": ["<up to 3 short, specific, actionable points>"], '
    '"fallacies": ["<logical fallacies the USER committed, named and briefly quoted; empty if none>"], '
    '"best_line": "<the USER\'s strongest sentence, quoted exactly, or empty>"}'
)


def _clamp_score(v) -> int:
    try:
        return max(1, min(10, int(round(float(v)))))
    except (TypeError, ValueError):
        return 5


def _normalize_feedback(data: Optional[dict]) -> dict:
    if not data:
        return {
            "scores": None,
            "summary": "Feedback isn't available right now — but every round you argue sharpens the next one.",
            "strengths": [], "improvements": [], "fallacies": [], "best_line": "",
            "fallback": True,
        }
    scores = data.get("scores") or {}
    return {
        "scores": {k: _clamp_score(scores.get(k)) for k in ("clarity", "evidence", "rebuttal", "civility")},
        "summary": str(data.get("summary") or "")[:500],
        "strengths": [str(s)[:200] for s in (data.get("strengths") or [])][:3],
        "improvements": [str(s)[:200] for s in (data.get("improvements") or [])][:3],
        "fallacies": [str(s)[:200] for s in (data.get("fallacies") or [])][:3],
        "best_line": str(data.get("best_line") or "")[:300],
        "fallback": False,
    }


@router.post("/spar/{debate_id}/end")
async def end_spar(debate_id: str, user: User = Depends(get_current_user), _xhr: None = Depends(require_xhr)):
    debate = await _owned_debate(debate_id, user)
    if debate["status"] == "ended":
        return _public(debate)

    feedback = None
    if debate.get("user_turns", 0) >= MIN_TURNS_FOR_FEEDBACK:
        history = await _messages(debate_id)
        data = await call_llm_json(
            FEEDBACK_SYSTEM,
            f"Topic: {debate['topic']}\nUSER argued {_side_label(debate['user_position'])}.\n\n{_transcript(history)}",
            session_id=f"{debate_id}-feedback",
        )
        feedback = _normalize_feedback(data)
        await bump_streak(user.user_id)

    updates = {"status": "ended", "ended_at": _now(), "feedback": feedback}
    await db.ai_debates.update_one({"debate_id": debate_id}, {"$set": updates})
    return _public({**debate, **updates})
