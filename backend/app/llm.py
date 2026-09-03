"""LLM integration via Groq (fast, generous free tier, no credit card —
replaces an earlier direct Gemini integration that kept 503ing "high
demand" on a newly-launched free-tier Flash model). All AI features
(stance analysis, topic generation, the debate coach, and the
category-drift watcher) share the same call-and-parse shape, so it lives
in one place instead of being duplicated per feature.
"""
import asyncio
import json
import logging
import uuid
from typing import List, Optional

from groq import AsyncGroq

from .config import GROQ_API_KEY, GROQ_MODEL

logger = logging.getLogger("indifferent")

_client: Optional[AsyncGroq] = None


def _get_client() -> Optional[AsyncGroq]:
    global _client
    if not GROQ_API_KEY:
        return None
    if _client is None:
        _client = AsyncGroq(api_key=GROQ_API_KEY)
    return _client


async def call_llm_json(system_message: str, prompt: str, session_id: Optional[str] = None) -> Optional[dict]:
    """Ask the model for a JSON response via response_format={"type":
    "json_object"} — Groq requires the word "JSON" to appear somewhere in
    the messages for this mode, which every system prompt in this file
    already satisfies ("Return ONLY valid JSON..."). Returns None on any
    failure (unconfigured, network, non-JSON reply) — callers decide their
    own fallback.

    Retries twice with a short backoff before giving up — kept from the
    earlier Gemini integration's defensive shape, since any hosted
    free-tier model can have a transient bad moment.
    """
    client = _get_client()
    if not client:
        logger.error("Groq not configured (GROQ_API_KEY unset)")
        return None
    last_error: Optional[Exception] = None
    for attempt in range(3):
        try:
            response = await client.chat.completions.create(
                model=GROQ_MODEL,
                messages=[
                    {"role": "system", "content": system_message},
                    {"role": "user", "content": prompt},
                ],
                response_format={"type": "json_object"},
            )
            return json.loads(response.choices[0].message.content)
        except Exception as e:
            last_error = e
            if attempt < 2:
                await asyncio.sleep(0.6 * (attempt + 1))  # 0.6s, then 1.2s
    logger.error(f"Groq call failed (session={session_id}) after 3 attempts: {last_error}")
    return None


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
    directional nudge) if there's no reasoning text or the model is unavailable."""
    if not reasoning or not reasoning.strip():
        return None
    prompt = f"Topic: {topic}\nSIDE A: {side_a_label}\nSIDE B: {side_b_label}\nSpectator's reasoning: {reasoning.strip()[:1000]}"
    return await call_llm_json(VOTE_REASONING_SYSTEM, prompt, session_id=f"vote-{uuid.uuid4().hex[:8]}")


async def generate_topics(tag: str, a: dict, b: dict) -> List[str]:
    """Ask the model for 3 debate prompts specific to one shared interest tag.
    a, b: {"position": float, "summary": str} — each side's TopicStance for `tag`."""
    prompt = (
        f"Two people are about to have a civil debate about {tag}. "
        f"Person A's stance: {a.get('summary') or 'no summary available'} (position {a.get('position', 0)} on a -10..10 scale). "
        f"Person B's stance: {b.get('summary') or 'no summary available'} (position {b.get('position', 0)} on a -10..10 scale). "
        f"Generate 3 short, provocative but respectful debate prompts (one sentence each), specific to {tag}, "
        "that highlight their likely disagreement. "
        'Return JSON only: {"topics": ["...", "...", "..."]}'
    )
    data = await call_llm_json(
        "You generate short debate prompts. Return only valid JSON.",
        prompt,
        session_id=f"topics-{uuid.uuid4().hex[:8]}",
    )
    if data is None:
        # Can't be politics-flavored by default any more — tag is arbitrary now,
        # so the fallback has to genuinely reference it rather than fall back to
        # a fixed political list.
        return [
            f"What's the most overrated thing in {tag} right now?",
            f"Is the direction {tag} is heading in a good one?",
            f"What's a widely-accepted opinion about {tag} that you think is actually wrong?",
        ]
    return (data.get("topics") or [])[:3]


TAG_QUESTIONS_SYSTEM = (
    "You write short Likert-scale (1=strongly disagree, 5=strongly agree) opinion "
    "statements to help profile someone's views within specific interest areas, for "
    "a debate-matching app. For EACH tag given, write 3-4 short, opinionated, "
    "one-sentence statements a fan/follower of that area would have a real, "
    "debatable opinion on — not trivia or factual questions. "
    "Return ONLY valid JSON matching this schema exactly:\n"
    '{"questions": [{"tag": "<one of the given tags, verbatim>", "text": "<statement>", "invert": <true|false>}, ...]}\n'
    "invert=true means agreeing with the statement counts as the NEGATIVE end of "
    "that tag's opinion spectrum, invert=false means agreeing counts as the "
    "POSITIVE end — vary this across each tag's own statements so the mapping "
    "isn't all one direction. No prose outside JSON. No markdown fences."
)


async def generate_tag_questions(tags: List[str]) -> List[dict]:
    """Ask the model for up to ~10 Likert statements spread across the given
    tags. Returns [] on any failure — caller (onboarding.py) owns the
    fallback bank, same convention as every other function in this file."""
    prompt = f"Tags: {tags}. Generate up to 10 total Likert statements across these tags, split roughly evenly."
    data = await call_llm_json(TAG_QUESTIONS_SYSTEM, prompt, session_id=f"tagq-{uuid.uuid4().hex[:8]}")
    if data is None:
        return []
    # Case-insensitive match, snapped back to OUR requested casing — a custom
    # tag (typed via onboarding's "Other") isn't guaranteed to come back
    # byte-identical (observed live with the earlier Gemini integration: it
    # re-cased a lowercase custom tag in its own reply — kept defensive here
    # regardless of provider). Matching case-sensitively silently dropped
    # every question for that tag, which reads identically to "the call
    # failed" even though it actually succeeded.
    requested_by_lower = {t.lower(): t for t in tags}
    out = []
    for i, q in enumerate(data.get("questions") or []):
        raw_tag = str(q.get("tag", "")).strip()
        tag = requested_by_lower.get(raw_tag.lower())
        if tag is None:
            continue  # model hallucinated a tag we didn't ask for — drop it, don't trust it
        out.append({"id": f"ai{i}", "tag": tag, "text": str(q.get("text", ""))[:200], "invert": bool(q.get("invert", False))})
    return out[:10]


TAG_STANCE_SYSTEM = (
    "You are analyzing what someone wrote about their interests, in relation to a "
    "specific set of tags. For EACH tag, infer their position within it and a short "
    "summary. Return ONLY valid JSON matching this schema exactly:\n"
    '{"<tag>": {"position": <number -10 to 10>, "summary": "<1 short sentence>", '
    '"tags": ["<2-4 short sub-topic labels>"]}, ...}\n'
    "Only include a tag if the text actually gives you something to go on for it — "
    "omit tags you can't infer anything about. position is just a self-consistent "
    "spectrum for that tag (no fixed meaning outside Politics) reflecting how "
    "strongly, and in which direction, they lean based on what they wrote. "
    "No prose outside JSON. No markdown fences."
)


async def analyze_free_text_for_tags(text: str, tags: List[str]) -> dict:
    """-> {tag: {"position": float, "summary": str, "tags": [str]}} for whichever
    of `tags` the free text actually said something about. {} if no text or
    the model is unavailable — caller blends 100% quiz-derived position for
    any tag missing here."""
    if not text or not text.strip():
        return {}
    prompt = f"Tags: {tags}\nText: {text.strip()[:3000]}"
    data = await call_llm_json(TAG_STANCE_SYSTEM, prompt, session_id=f"tagstance-{uuid.uuid4().hex[:8]}")
    if data is None:
        return {}
    out = {}
    for tag in tags:
        d = data.get(tag)
        if not isinstance(d, dict):
            continue
        out[tag] = {
            "position": max(-10.0, min(10.0, float(d.get("position", 0)))),
            "summary": str(d.get("summary", ""))[:400],
            "tags": [str(t)[:30] for t in (d.get("tags") or [])][:6],
        }
    return out
