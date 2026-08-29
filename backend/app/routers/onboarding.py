from typing import Dict, List

from fastapi import APIRouter, Depends

from ..db import db
from ..deps import get_current_user
from ..llm import analyze_free_text
from ..models import OnboardingSubmit, StanceScores, User
from ..topic_stances import upsert_topic_stance

router = APIRouter()

QUIZ_QUESTIONS = [
    {"id": "q1", "text": "The government should tax the wealthy more to fund social programs.", "axis": "economic", "invert": True},
    {"id": "q2", "text": "Free markets, with minimal regulation, produce the best outcomes.", "axis": "economic", "invert": False},
    {"id": "q3", "text": "Immigration strengthens our country and should be expanded.", "axis": "social", "invert": True},
    {"id": "q4", "text": "Traditional family values are essential to a healthy society.", "axis": "social", "invert": False},
    {"id": "q5", "text": "Aggressive action on climate change is worth the economic cost.", "axis": "economic", "invert": True},
    {"id": "q6", "text": "Stricter gun control laws would make our country safer.", "axis": "social", "invert": True},
    {"id": "q7", "text": "Healthcare should be provided by the government as a right.", "axis": "economic", "invert": True},
    {"id": "q8", "text": "National identity and cultural heritage should be prioritized in policy.", "axis": "social", "invert": False},
]


def quiz_to_scores(answers: Dict[str, int]) -> tuple[float, float]:
    """Convert quiz Likert answers (1-5) to two scores in [-10, 10]."""
    econ_vals: List[float] = []
    soc_vals: List[float] = []
    for q in QUIZ_QUESTIONS:
        raw = answers.get(q["id"])
        if raw is None:
            continue
        v = (int(raw) - 3) * 5  # 1..5 -> -10..10
        if q["invert"]:
            v = -v
        (econ_vals if q["axis"] == "economic" else soc_vals).append(v)
    econ = sum(econ_vals) / len(econ_vals) if econ_vals else 0.0
    soc = sum(soc_vals) / len(soc_vals) if soc_vals else 0.0
    return econ, soc


@router.post("/onboarding/submit", response_model=User)
async def submit_onboarding(payload: OnboardingSubmit, user: User = Depends(get_current_user)):
    econ_q, soc_q = quiz_to_scores(payload.quiz_answers or {})
    ai_stance = await analyze_free_text(payload.free_text or "")
    # Blend: 60% AI free-text (if provided) + 40% quiz. If no free text, 100% quiz.
    if payload.free_text and payload.free_text.strip():
        econ = 0.6 * ai_stance.economic + 0.4 * econ_q
        soc = 0.6 * ai_stance.social + 0.4 * soc_q
    else:
        econ, soc = econ_q, soc_q
    final = StanceScores(
        economic=round(econ, 2),
        social=round(soc, 2),
        summary=ai_stance.summary or "Stance derived from quiz answers.",
        tags=ai_stance.tags,
    )
    update = {
        "stance": final.model_dump(),
        "onboarded": True,
    }
    if payload.display_name:
        update["display_name"] = payload.display_name[:40]
    if payload.bio is not None:
        update["bio"] = payload.bio[:300]
    await db.users.update_one({"user_id": user.user_id}, {"$set": update})

    # Mirror into the generalized per-topic spectrum model so the profile UI can
    # render politics as two rows in the same list as every other category,
    # instead of a one-off two-axis square map (client brief #10).
    await upsert_topic_stance(user.user_id, "Politics: Economic", "Politics", final.economic, final.summary, final.tags)
    await upsert_topic_stance(user.user_id, "Politics: Social", "Politics", final.social, final.summary, final.tags)

    doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
    return User(**doc)


@router.get("/onboarding/questions")
async def get_questions():
    return {"questions": [{"id": q["id"], "text": q["text"]} for q in QUIZ_QUESTIONS]}
