"""Shared write path for models.TopicStance — used by onboarding's political
quiz (the authoritative, one-shot self-report) and, generalized to any
category, by post-debate agree/disagree reasoning (client brief #18)."""
from datetime import datetime, timezone
from typing import List, Optional

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
    await db.topic_stances.update_one(
        {"user_id": user_id, "topic": topic},
        {"$set": {
            "user_id": user_id, "topic": topic, "category": category,
            "position": round(position, 3), "summary": summary or "", "tags": tags or [],
            "sample_count": sample_count + 1,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }},
        upsert=True,
    )
