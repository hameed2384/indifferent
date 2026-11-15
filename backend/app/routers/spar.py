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
import re
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel

from ..db import db
from ..deps import get_current_user, get_current_user_optional, require_xhr
from ..llm import call_llm_json, generate_topics
from ..models import User
from ..ratelimit import rate_limit
from ..streaks import bump_streak
from ..topic_stances import get_tag_positions

router = APIRouter()

MAX_USER_TURNS = 12
MAX_MESSAGE = 800
MIN_TURNS_FOR_FEEDBACK = 1
MAX_GUEST_TURNS = 6
REUSE_UNTOUCHED_HOURS = 6

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


# onboarding.py's placeholder when the AI couldn't summarize a stance — not
# something to show back to the user as "their view".
_PLACEHOLDER_SUMMARY = "Stance derived from quiz answers."


def _real_summary(summary: Optional[str]) -> str:
    return "" if not summary or summary.strip() == _PLACEHOLDER_SUMMARY else summary.strip()


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
        "user_turns", "created_at", "ended_at", "feedback", "share_id",
    )}
    out["max_user_turns"] = _turn_cap(debate)
    out["guest"] = _is_guest(debate)
    out["user_side"] = _side_label(debate["user_position"])
    out["ai_side"] = _side_label(debate["ai_position"])
    # The user's own onboarding stance in words — a clearer way to show the
    # two sides than "for/against" when the generated topic is a question.
    out["user_view"] = _real_summary(debate.get("user_summary"))
    if messages is not None:
        out["messages"] = [{"role": m["role"], "text": m["text"], "created_at": m["created_at"]} for m in messages]
    return out


# --- Ownership: signed-in users OR guests -----------------------------------
# A debate's user_id is either a real user_id or "guest:<token>", where the
# token is a random secret only the guest's browser holds (sent back as the
# X-Guest-Token header). Guests let a first-time visitor try a full round
# before signing up; they can claim it into an account afterwards.
GUEST_PREFIX = "guest:"
_GUEST_TOKEN_RE = re.compile(r"^[A-Za-z0-9_-]{20,64}$")


async def _owner_key(
    user: Optional[User] = Depends(get_current_user_optional),
    x_guest_token: Optional[str] = Header(None),
) -> str:
    if user:
        return user.user_id
    if x_guest_token and _GUEST_TOKEN_RE.match(x_guest_token):
        return GUEST_PREFIX + x_guest_token
    raise HTTPException(status_code=401, detail="Not authenticated")


def _is_guest(debate: dict) -> bool:
    return debate["user_id"].startswith(GUEST_PREFIX)


def _turn_cap(debate: dict) -> int:
    return MAX_GUEST_TURNS if _is_guest(debate) else MAX_USER_TURNS


async def _owned_debate(debate_id: str, owner: str) -> dict:
    debate = await db.ai_debates.find_one({"debate_id": debate_id}, {"_id": 0})
    if not debate or debate["user_id"] != owner:
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

    # Reuse a recent round on this topic the user hasn't argued in yet,
    # instead of piling up empty "in progress" rounds (and LLM calls) every
    # time they click start and wander off.
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=REUSE_UNTOUCHED_HOURS)).isoformat()
    untouched = await db.ai_debates.find_one(
        {"user_id": user.user_id, "tag": tag, "status": "active", "user_turns": 0, "created_at": {"$gt": cutoff}},
        {"_id": 0}, sort=[("created_at", -1)],
    )
    if untouched:
        return _public(untouched, await _messages(untouched["debate_id"]))

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
    view = _real_summary(mine.get("summary"))
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


# --- Guest rounds -------------------------------------------------------------
# Curated motions for visitors who haven't signed up or onboarded (so have no
# stances to argue against). Statements, not questions, so "for/against" is
# unambiguous. Registered before /spar/{debate_id} on purpose.
MOTIONS = [
    {"id": "remote-work", "tag": "Technology", "motion": "Remote work is better than working in an office"},
    {"id": "ai-jobs", "tag": "Technology", "motion": "AI will create more jobs than it destroys"},
    {"id": "social-media-teens", "tag": "Technology", "motion": "Under-16s should be banned from social media"},
    {"id": "athlete-pay", "tag": "Sports", "motion": "Top athletes are overpaid"},
    {"id": "four-day-week", "tag": "Politics", "motion": "Every country should move to a four-day work week"},
    {"id": "voting-age", "tag": "Politics", "motion": "The voting age should be lowered to 16"},
    {"id": "meat-tax", "tag": "Science", "motion": "Meat should be taxed like cigarettes"},
    {"id": "space", "tag": "Science", "motion": "Spending on space exploration is worth it"},
    {"id": "remakes", "tag": "Movies & TV", "motion": "Hollywood remakes are ruining cinema"},
    {"id": "homework", "tag": "Education", "motion": "Schools should abolish homework"},
]
_MOTIONS_BY_ID = {m["id"]: m for m in MOTIONS}


@router.get("/spar/guest/motions")
async def guest_motions():
    return {"motions": MOTIONS, "max_turns": MAX_GUEST_TURNS}


class GuestStart(BaseModel):
    motion_id: str
    side: str  # "for" | "against"


@router.post("/spar/guest/start")
async def start_guest_spar(
    payload: GuestStart,
    _rl: None = Depends(rate_limit("spar_guest_start", limit=5, window_seconds=3600)),
):
    motion = _MOTIONS_BY_ID.get(payload.motion_id)
    if not motion:
        raise HTTPException(status_code=400, detail="Unknown motion")
    if payload.side not in ("for", "against"):
        raise HTTPException(status_code=400, detail="side must be 'for' or 'against'")

    token = secrets.token_urlsafe(24)
    user_pos = 7.0 if payload.side == "for" else -7.0
    debate = {
        "debate_id": f"spar_{uuid.uuid4().hex[:12]}",
        "user_id": GUEST_PREFIX + token,
        "tag": motion["tag"],
        "topic": motion["motion"],
        "user_position": user_pos,
        "user_summary": motion["motion"] if payload.side == "for" else f"Against: {motion['motion']}",
        "ai_position": -user_pos,
        "status": "active",
        "user_turns": 0,
        "created_at": _now(),
    }
    await db.ai_debates.insert_one(dict(debate))
    data = await call_llm_json(
        _system_prompt(debate),
        "Open the debate: state your position on the motion in 2-3 sentences with your single "
        "strongest reason, then invite the user to make their case.",
        session_id=debate["debate_id"],
    )
    stance = "against" if payload.side == "for" else "for"
    opening = (data or {}).get("reply") or (
        f"I'm arguing {stance} the motion: \"{motion['motion']}\". The case for my side is stronger than it looks. "
        "Make your best argument and I'll test it."
    )
    msg = await _add_message(debate["debate_id"], "ai", opening.strip()[:1200])
    return {**_public(debate, [msg]), "guest_token": token}


@router.get("/spar/{debate_id}")
async def get_spar(debate_id: str, owner: str = Depends(_owner_key)):
    debate = await _owned_debate(debate_id, owner)
    return _public(debate, await _messages(debate_id))


class SparMessage(BaseModel):
    text: str


@router.post("/spar/{debate_id}/message")
async def send_spar_message(
    debate_id: str,
    payload: SparMessage,
    owner: str = Depends(_owner_key),
    _rl: None = Depends(rate_limit("spar_message", limit=20, window_seconds=60)),
):
    debate = await _owned_debate(debate_id, owner)
    if debate["status"] != "active":
        raise HTTPException(status_code=400, detail="This debate has ended")
    if debate.get("user_turns", 0) >= _turn_cap(debate):
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
        "turns_left": max(0, _turn_cap(debate) - turns),
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
async def end_spar(debate_id: str, owner: str = Depends(_owner_key), _xhr: None = Depends(require_xhr)):
    debate = await _owned_debate(debate_id, owner)
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
        if not _is_guest(debate):
            await bump_streak(owner)

    updates = {"status": "ended", "ended_at": _now(), "feedback": feedback}
    await db.ai_debates.update_one({"debate_id": debate_id}, {"$set": updates})
    return _public({**debate, **updates})


# --- Sharing a result (growth loop) -----------------------------------------
# A finished round can be shared as a public result card: topic, scores,
# summary and the user's best line — never the transcript, which stays
# private. Opt-in per round, by the owner only.

def _avg(scores: Optional[dict]) -> Optional[float]:
    if not scores:
        return None
    return round(sum(scores.values()) / len(scores), 1)


@router.post("/spar/{debate_id}/share")
async def share_spar(debate_id: str, user: User = Depends(get_current_user), _xhr: None = Depends(require_xhr)):
    debate = await _owned_debate(debate_id, user.user_id)
    if debate["status"] != "ended" or not (debate.get("feedback") or {}).get("scores"):
        raise HTTPException(status_code=400, detail="Finish a scored round to share it")
    share_id = debate.get("share_id") or f"s{uuid.uuid4().hex[:10]}"
    await db.ai_debates.update_one({"debate_id": debate_id}, {"$set": {"share_id": share_id}})
    return {"share_id": share_id}


@router.get("/public/spar/{share_id}")
async def public_spar_result(share_id: str):
    debate = await db.ai_debates.find_one({"share_id": share_id}, {"_id": 0})
    if not debate:
        raise HTTPException(status_code=404, detail="Result not found")
    owner = await db.users.find_one({"user_id": debate["user_id"]}, {"_id": 0, "display_name": 1, "name": 1}) or {}
    feedback = debate.get("feedback") or {}
    return {
        "share_id": share_id,
        "display_name": owner.get("display_name") or (owner.get("name") or "Someone").split(" ")[0],
        "tag": debate["tag"],
        "topic": debate["topic"],
        "scores": feedback.get("scores"),
        "average": _avg(feedback.get("scores")),
        "summary": feedback.get("summary", ""),
        "best_line": feedback.get("best_line", ""),
        "created_at": debate.get("created_at"),
    }


@router.post("/spar/{debate_id}/claim")
async def claim_guest_spar(
    debate_id: str,
    user: User = Depends(get_current_user),
    x_guest_token: Optional[str] = Header(None),
    _xhr: None = Depends(require_xhr),
):
    """Move a guest round into the signed-in user's account (after they sign
    up from the guest report), so their first debate isn't lost."""
    if not x_guest_token or not _GUEST_TOKEN_RE.match(x_guest_token):
        raise HTTPException(status_code=400, detail="Missing guest token")
    debate = await _owned_debate(debate_id, GUEST_PREFIX + x_guest_token)
    await db.ai_debates.update_one({"debate_id": debate_id}, {"$set": {"user_id": user.user_id}})
    if debate.get("feedback") and debate["status"] == "ended":
        await bump_streak(user.user_id)
    return {"debate_id": debate_id, "claimed": True}
