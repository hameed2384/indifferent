"""Shared write path for models.TopicStance — used by onboarding's tag-driven
quiz (the authoritative, one-shot self-report) and, generalized to any
category, by post-debate agree/disagree reasoning (client brief #18). Also
the shared read path for matchmaking's per-tag opposition scoring — both
match.py (queue matching) and private.py (go_public) need "does this pair
share a tag, and how opposed are they on it," so it lives here rather than
being duplicated in each router."""
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple

from .db import db


async def upsert_topic_stance(
    user_id: str, topic: str, category: str, position: float,
    summary: str = "", tags: Optional[List[str]] = None, *, blend: bool = False,
):
    """blend=False (onboarding) sets the position outright — that's the user's
    own stated stance, an authority no downstream signal should dilute.
    blend=True (debate outcomes / agree-disagree reasoning) folds the new
    signal into a running average instead, so any single post-debate signal
    nudges an established profile rather than overwriting it.
    """
    existing = await db.topic_stances.find_one({"user_id": user_id, "topic": topic}, {"_id": 0})
    sample_count = (existing or {}).get("sample_count", 0)
    if blend and existing and sample_count > 0:
        position = (existing["position"] * sample_count + position) / (sample_count + 1)
        summary = summary or existing.get("summary", "")
        tags = tags if tags else existing.get("tags", [])
    now = datetime.now(timezone.utc).isoformat()
    final_position = round(position, 3)
    await db.topic_stances.update_one(
        {"user_id": user_id, "topic": topic},
        {"$set": {
            "user_id": user_id, "topic": topic, "category": category,
            "position": final_position, "summary": summary or "", "tags": tags or [],
            "sample_count": sample_count + 1,
            "updated_at": now,
        }},
        upsert=True,
    )
    # Append-only log purely so a later read can answer "how has this moved
    # over time" — topic_stances itself only ever holds the current blended
    # value, with no memory of where it started. Written on every call
    # (including the very first, blend=False one) so that first entry is the
    # baseline everything else measures against.
    await db.topic_stance_history.insert_one({
        "user_id": user_id, "topic": topic, "position": final_position, "created_at": now,
    })


async def get_tag_positions(user_id: str, tags: List[str]) -> Dict[str, dict]:
    """This user's TopicStance rows for the given tags -> {tag: {"position", "summary"}}.
    A tag the user has no row for yet (chosen at onboarding but somehow never
    persisted) is simply absent from the result — callers treat that the same
    as "no overlap" rather than guessing a position."""
    if not tags:
        return {}
    docs = await db.topic_stances.find({"user_id": user_id, "topic": {"$in": tags}}, {"_id": 0}).to_list(len(tags))
    return {d["topic"]: {"position": d["position"], "summary": d.get("summary", "")} for d in docs}


def shared_tag_opposition(a: Dict[str, dict], b: Dict[str, dict]) -> Optional[Tuple[str, float]]:
    """(best_tag, opposition) for the single most-opposing tag two people
    actually SHARE, or None if they have no tag in common at all — a debate
    needs a shared topic, so no-overlap is a real "can't match" signal, not
    just a low score."""
    shared = set(a) & set(b)
    if not shared:
        return None
    return max(((t, abs(a[t]["position"] - b[t]["position"])) for t in shared), key=lambda x: x[1])
