from typing import Dict, List

from fastapi import APIRouter, Depends, HTTPException

from ..categories import CATEGORIES
from ..db import db
from ..deps import get_current_user
from ..llm import analyze_free_text_for_tags, generate_tag_questions
from ..models import LikertQuestion, OnboardingSubmit, TagQuestionsRequest, TagQuestionsResponse, User
from ..topic_stances import upsert_topic_stance

router = APIRouter()

# Real, hand-written fallback bank — not a stub. This runs whenever the
# GROQ_API_KEY is unset or a call fails, so it needs to be a genuinely
# usable question set per tag, same standard as the old fixed 8-question
# quiz it replaces.
FALLBACK_TAG_QUESTIONS: Dict[str, List[dict]] = {
    "Politics": [
        {"text": "The government should tax the wealthy more to fund social programs.", "invert": True},
        {"text": "Traditional family values are essential to a healthy society.", "invert": False},
        {"text": "Immigration strengthens our country and should be expanded.", "invert": True},
        {"text": "Free markets, with minimal regulation, produce the best outcomes.", "invert": False},
    ],
    "Sports": [
        {"text": "Superstar players matter more to a team's success than coaching.", "invert": False},
        {"text": "Individual talent matters more than team chemistry.", "invert": False},
        {"text": "Modern athletes are overpaid relative to their impact.", "invert": True},
        {"text": "Statistics and analytics have made sports worse to watch.", "invert": True},
    ],
    "Music": [
        {"text": "Mainstream pop is creatively inferior to underground/indie music.", "invert": False},
        {"text": "Auto-tune and production tricks ruin authentic musical talent.", "invert": False},
        {"text": "Streaming has been good for music as an art form.", "invert": True},
        {"text": "Physical media (vinyl, CDs) sounds meaningfully better than digital.", "invert": False},
    ],
    "Anime": [
        {"text": "Subbed anime is always better than dubbed.", "invert": False},
        {"text": "Long-running shonen anime are overrated compared to shorter series.", "invert": False},
        {"text": "Anime has become too focused on fan service in recent years.", "invert": False},
        {"text": "Studio Ghibli-style films are more artistically valuable than typical shonen action.", "invert": False},
    ],
    "Movies & TV": [
        {"text": "Streaming services have made movies and TV worse overall.", "invert": False},
        {"text": "Remakes and reboots are creatively lazy.", "invert": False},
        {"text": "Superhero movies have been good for the film industry.", "invert": True},
        {"text": "Critics' opinions matter more than audience scores.", "invert": False},
    ],
    "Technology": [
        {"text": "AI will do more good than harm for society.", "invert": True},
        {"text": "Social media has been bad for society overall.", "invert": False},
        {"text": "Big tech companies need much stricter regulation.", "invert": False},
        {"text": "Newer isn't always better when it comes to technology.", "invert": False},
    ],
    "Gaming": [
        {"text": "Single-player story-driven games matter more than competitive multiplayer.", "invert": False},
        {"text": "Microtransactions have ruined modern gaming.", "invert": False},
        {"text": "Remasters and remakes are usually worth it over playing the original.", "invert": True},
        {"text": "Difficulty options should always be available in every game.", "invert": True},
    ],
    "Science": [
        {"text": "Space exploration funding is worth the cost.", "invert": True},
        {"text": "Scientific consensus should rarely be publicly questioned.", "invert": False},
        {"text": "We should prioritize practical research over pure/theoretical science.", "invert": False},
        {"text": "Genetic engineering in humans will do more good than harm.", "invert": True},
    ],
    "Relationships": [
        {"text": "Long-distance relationships rarely work out.", "invert": False},
        {"text": "Compatibility matters more than initial attraction.", "invert": True},
        {"text": "Social media has made modern dating worse.", "invert": False},
        {"text": "People should prioritize their career over relationships in their 20s.", "invert": False},
    ],
    "Religion": [
        {"text": "Religion provides more good than harm to society.", "invert": True},
        {"text": "Religious institutions should have less influence on public policy.", "invert": False},
        {"text": "Faith and science are fundamentally compatible.", "invert": True},
        {"text": "Organized religion is becoming less relevant in modern life.", "invert": False},
    ],
    "Other": [
        {"text": "People online are ruder than they'd be in person.", "invert": False},
        {"text": "Most viral trends are more annoying than entertaining.", "invert": False},
        {"text": "Cancel culture does more good than harm.", "invert": True},
        {"text": "People take most disagreements online too seriously.", "invert": False},
    ],
}

# For a custom tag typed via "Other" — there's no hand-written bank for an
# arbitrary user-chosen string, so these {tag}-substituted templates are what
# actually runs whenever Gemini is unconfigured (the live case in this
# environment right now) and the tag isn't one of the fixed 11.
GENERIC_FALLBACK_QUESTIONS = [
    {"text": "{tag} is more overrated than people give it credit for.", "invert": False},
    {"text": "Most mainstream opinions about {tag} are basically right.", "invert": True},
    {"text": "I have strong opinions about {tag} that most people I know don't share.", "invert": False},
    {"text": "{tag} has gotten worse, not better, in recent years.", "invert": False},
]


def _fallback_bank_for(tag: str) -> List[dict]:
    if tag in FALLBACK_TAG_QUESTIONS:
        return FALLBACK_TAG_QUESTIONS[tag]
    return [{"text": q["text"].format(tag=tag), "invert": q["invert"]} for q in GENERIC_FALLBACK_QUESTIONS]


def _fallback_questions_for(tags: List[str], limit: int) -> List[LikertQuestion]:
    """Round-robin across the chosen tags rather than exhausting one tag's
    bank before moving to the next, so a 3-tag pick reliably samples all
    three instead of front-loading whichever tag happened to be first."""
    banks = {t: _fallback_bank_for(t) for t in tags}
    per_tag_idx = {t: 0 for t in tags}
    out: List[LikertQuestion] = []
    i = 0
    while len(out) < limit and any(per_tag_idx[t] < len(banks[t]) for t in tags):
        tag = tags[i % len(tags)]
        bank = banks[tag]
        idx = per_tag_idx[tag]
        if idx < len(bank):
            q = bank[idx]
            out.append(LikertQuestion(id=f"fb{len(out)}", tag=tag, text=q["text"], invert=q["invert"]))
            per_tag_idx[tag] += 1
        i += 1
    return out


def _normalize_tags(raw_tags: List[str]) -> List[str]:
    """Trim/cap each tag and snap it to a fixed CATEGORIES entry's canonical
    casing if it matches one case-insensitively — otherwise it's a genuine
    custom tag (typed via "Other"). Without this, someone typing "sports" as
    a custom tag would silently fork away from the fixed "Sports" tag: two
    different TopicStance rows meaning the same thing, and two people who'd
    otherwise share a tag no longer matching each other."""
    out = []
    for raw in raw_tags:
        t = (raw or "").strip()[:30]
        if not t:
            continue
        canonical = next((c for c in CATEGORIES if c.lower() == t.lower()), None)
        out.append(canonical or t)
    return list(dict.fromkeys(out))[:3]  # de-dupe (post-normalization), cap at 3


def quiz_to_tag_positions(questions: List[LikertQuestion], answers: Dict[str, int]) -> Dict[str, float]:
    """Generalizes the old quiz_to_scores' (raw-3)*5 + invert + average math
    from two fixed axes to arbitrary tags — grouped by question.tag instead."""
    by_tag: Dict[str, List[float]] = {}
    for q in questions:
        raw = answers.get(q.id)
        if raw is None:
            continue
        raw = max(1, min(5, int(raw)))  # clamp: a bogus answer shouldn't blow the -10..10 range
        v = (raw - 3) * 5  # 1..5 -> -10..10
        if q.invert:
            v = -v
        by_tag.setdefault(q.tag, []).append(v)
    return {tag: sum(vals) / len(vals) for tag, vals in by_tag.items()}


@router.post("/onboarding/questions/generate", response_model=TagQuestionsResponse)
async def generate_questions(payload: TagQuestionsRequest, user: User = Depends(get_current_user)):
    tags = _normalize_tags(payload.tags)
    if not tags:
        raise HTTPException(status_code=400, detail="Pick at least one tag")

    ai = await generate_tag_questions(tags)
    questions = [LikertQuestion(**q) for q in ai]

    # Fill in any tag the AI skipped (partial failure) or the whole set if
    # Gemini is unconfigured — never leave a chosen tag with zero questions.
    covered = {q.tag for q in questions}
    missing = [t for t in tags if t not in covered]
    if missing or not questions:
        remaining_slots = max(0, 10 - len(questions))
        questions += _fallback_questions_for(missing or tags, remaining_slots)

    return TagQuestionsResponse(questions=questions[:10])


@router.post("/onboarding/submit", response_model=User)
async def submit_onboarding(payload: OnboardingSubmit, user: User = Depends(get_current_user)):
    tags = _normalize_tags(payload.tags)
    if not tags:
        raise HTTPException(status_code=400, detail="Pick at least one tag")
    # Trust boundary: invert is echoed back by the client (no server-side
    # session storage for the AI-generated question set — see
    # Onboarding.jsx). Drop anything claiming a tag we didn't ask about
    # rather than trusting it outright.
    questions = [q for q in payload.questions if q.tag in tags]

    free_text = (payload.free_text or "")[:3000]
    quiz_positions = quiz_to_tag_positions(questions, payload.quiz_answers or {})
    ai_positions = await analyze_free_text_for_tags(free_text, tags)

    final: Dict[str, dict] = {}
    for tag in tags:
        q_pos = quiz_positions.get(tag, 0.0)
        ai_tag = ai_positions.get(tag)
        if ai_tag is not None:
            position = 0.6 * ai_tag["position"] + 0.4 * q_pos
            summary = ai_tag["summary"] or "Stance derived from quiz answers."
            sub_tags = ai_tag["tags"]
        else:
            position = q_pos
            summary = "Stance derived from quiz answers."
            sub_tags = []
        final[tag] = {
            "position": round(max(-10.0, min(10.0, position)), 2),
            "summary": summary,
            "tags": sub_tags,
        }

    update = {
        "interest_tags": tags,
        "onboarded": True,
    }
    if payload.display_name:
        update["display_name"] = payload.display_name[:40]
    if payload.bio is not None:
        update["bio"] = payload.bio[:300]
    await db.users.update_one({"user_id": user.user_id}, {"$set": update})

    # One TopicStance row per tag — topic == category == the tag itself
    # (a flat tag has no sub-axis the way Politics used to split into
    # Economic/Social). This is what the profile page already renders and
    # what matchmaking reads from — no other persistence needed.
    for tag, data in final.items():
        await upsert_topic_stance(user.user_id, tag, tag, data["position"], data["summary"], data["tags"])

    doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
    return User(**doc)
