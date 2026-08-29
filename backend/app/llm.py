"""Gemini integration via Google's official google-genai SDK (direct — replaces
the old Emergent LLM proxy). All AI features (stance analysis, topic
generation, the debate coach, and the category-drift watcher added later)
share the same call-and-parse shape, so it lives in one place instead of
being duplicated per feature.
"""
import json
import logging
import uuid
from typing import List, Optional

from google import genai
from google.genai import types as genai_types

from .config import GEMINI_API_KEY, GEMINI_MODEL
from .models import StanceScores

logger = logging.getLogger("indifferent")

_client: Optional[genai.Client] = None


def _get_client() -> Optional[genai.Client]:
    global _client
    if not GEMINI_API_KEY:
        return None
    if _client is None:
        _client = genai.Client(api_key=GEMINI_API_KEY)
    return _client


async def call_gemini_json(system_message: str, prompt: str, session_id: Optional[str] = None) -> Optional[dict]:
    """Ask Gemini for a JSON response — requested directly via response_mime_type
    (no markdown-fence stripping needed). Returns None on any failure (unconfigured,
    network, non-JSON reply) — callers decide their own fallback.
    """
    client = _get_client()
    if not client:
        logger.error("Gemini not configured (GEMINI_API_KEY unset)")
        return None
    try:
        response = await client.aio.models.generate_content(
            model=GEMINI_MODEL,
            contents=prompt,
            config=genai_types.GenerateContentConfig(
                system_instruction=system_message,
                response_mime_type="application/json",
            ),
        )
        return json.loads(response.text)
    except Exception as e:
        logger.error(f"Gemini call failed (session={session_id}): {e}")
        return None


STANCE_SYSTEM = (
    "You are an objective political scientist. Analyze the user's political views. "
    "Return ONLY valid JSON matching this schema exactly:\n"
    '{"economic": <number -10 to 10>, "social": <number -10 to 10>, '
    '"summary": "<1-2 sentences summarizing the person\'s views>", '
    '"tags": ["<3-6 short topic tags>"]}\n'
    "Scale: economic -10 = strongly progressive/left (redistribution, public services), "
    "+10 = strongly conservative/right (free markets, low taxes). "
    "social -10 = liberal/progressive (individual rights, secular, cosmopolitan), "
    "+10 = traditional (family, religion, national identity). "
    "No prose outside JSON. No markdown fences."
)


async def analyze_free_text(text: str) -> StanceScores:
    """Send free-text views to Gemini and parse the JSON stance response."""
    if not text or not text.strip():
        return StanceScores()
    data = await call_gemini_json(STANCE_SYSTEM, text.strip(), session_id=f"stance-{uuid.uuid4().hex[:8]}")
    if data is None:
        return StanceScores(summary="(AI analysis unavailable — will be refined during debates.)")
    return StanceScores(
        economic=max(-10, min(10, float(data.get("economic", 0)))),
        social=max(-10, min(10, float(data.get("social", 0)))),
        summary=str(data.get("summary", ""))[:400],
        tags=[str(t)[:30] for t in (data.get("tags") or [])][:6],
    )


VOTE_REASONING_SYSTEM = (
    "You analyze a spectator's reasoning after watching a debate and place their view on a "
    "single -10..10 spectrum for the debate's topic, where -10 means fully agreeing with "
    "the side labeled SIDE A and +10 means fully agreeing with the side labeled SIDE B. "
    'Return ONLY JSON: {"position": <number -10..10>, "summary": "<1 short sentence>", '
    '"tags": ["<2-4 short topic tags>"]}. No prose outside JSON, no markdown fences.'
)


async def analyze_vote_reasoning(topic: str, side_a_label: str, side_b_label: str, reasoning: str) -> Optional[dict]:
    """Client brief #18 — a viewer's agree/disagree reasoning refines their own
    topic_stances position. Returns None (caller falls back to a flat
    directional nudge) if there's no reasoning text or Gemini is unavailable."""
    if not reasoning or not reasoning.strip():
        return None
    prompt = f"Topic: {topic}\nSIDE A: {side_a_label}\nSIDE B: {side_b_label}\nSpectator's reasoning: {reasoning.strip()[:1000]}"
    return await call_gemini_json(VOTE_REASONING_SYSTEM, prompt, session_id=f"vote-{uuid.uuid4().hex[:8]}")


async def generate_topics(a: StanceScores, b: StanceScores) -> List[str]:
    """Ask Gemini for 3 debate prompts tailored to two opposing stances."""
    prompt = (
        f"Two people are about to have a civil debate. Person A stance: economic={a.economic}, "
        f"social={a.social}, tags={a.tags}. Person B stance: economic={b.economic}, "
        f"social={b.social}, tags={b.tags}. Generate 3 short, provocative but respectful debate "
        "prompts (one sentence each) that highlight their likely disagreements. "
        'Return JSON only: {"topics": ["...", "...", "..."]}'
    )
    data = await call_gemini_json(
        "You generate short debate prompts. Return only valid JSON.",
        prompt,
        session_id=f"topics-{uuid.uuid4().hex[:8]}",
    )
    if data is None:
        return [
            "Should the government redistribute wealth to reduce inequality?",
            "Is immigration a net positive for society?",
            "How should we balance economic growth with climate action?",
        ]
    return (data.get("topics") or [])[:3]
