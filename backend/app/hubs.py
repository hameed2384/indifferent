"""The AI debate coach — stateless, DB-backed, called inline from the chat-send
endpoint (see routers/rooms.py) instead of running as a persistent background
task. There's no long-lived process on serverless to host a background loop or
in-memory WebSocket hubs in, so trigger/cooldown state that used to live in
Python dicts (RoomHub, SpectatorHub, DebateCoach) now lives on the `rooms`
document itself, and nudges are persisted to `coach_nudges` and picked up by
polling — which also fixes an old gap where nudges were broadcast-only and lost
on reconnect.

Rule (unchanged from the original in-memory version): after every 5th chat
message, check in — but never more often than once per 15s.
"""
import logging
from datetime import datetime, timezone

from .categories import CATEGORIES
from .db import db
from .llm import call_gemini_json
from .room_utils import member_side

logger = logging.getLogger("indifferent")

COACH_SYSTEM = (
    "You are a neutral debate coach observing a live civil discussion between two people with "
    "opposing political views. Read the recent transcript and decide whether an intervention is "
    "warranted. Emit an intervention ONLY IF you detect: a logical fallacy (ad hominem, straw man, "
    "false dichotomy, hasty generalization, whataboutism, appeal to emotion), rising hostility, "
    "or someone dodging the other's actual point. Otherwise, stay silent.\n"
    "Return ONLY JSON: "
    '{"intervene": true|false, "kind": "fallacy|tone|dodge|steelman|null", '
    '"nudge": "<one-sentence private note to both debaters, <=140 chars, addressed to no one in '
    'particular, no names>", "target": "a|b|both"} '
    "If not intervening, return {\"intervene\": false}. No prose, no markdown."
)


async def maybe_run_coach(room_id: str, room: dict):
    """Call after persisting a chat message. Bumps the room's message counter;
    once it hits 5 (and the 15s cooldown has elapsed), analyzes the recent
    transcript and persists a coach_nudges doc if Gemini flags something.
    The counter is always reset when a check is attempted — cooldown-skipped
    or not — so a burst of messages during cooldown can't spin the counter up
    without bound (the original in-memory version had exactly this bug).
    """
    count = room.get("coach_msg_count", 0) + 1
    if count < 5:
        await db.rooms.update_one({"room_id": room_id}, {"$set": {"coach_msg_count": count}})
        return

    now = datetime.now(timezone.utc)
    last_emit = room.get("coach_last_emit_at")
    if last_emit:
        last_emit_dt = datetime.fromisoformat(last_emit)
        if (now - last_emit_dt).total_seconds() < 15:
            await db.rooms.update_one({"room_id": room_id}, {"$set": {"coach_msg_count": 0}})
            return

    await db.rooms.update_one({"room_id": room_id}, {"$set": {"coach_msg_count": 0}})

    msgs = await db.chat_messages.find({"room_id": room_id}, {"_id": 0}).sort("created_at", -1).to_list(12)
    if not msgs:
        return
    msgs.reverse()
    transcript = "\n".join(
        f"{(member_side(room, m['sender_id']) or 'b').upper()}: {m['text']}" for m in msgs
    )
    data = await call_gemini_json(COACH_SYSTEM, f"Recent transcript:\n{transcript}", session_id=f"coach-{room_id}")
    if not data or not data.get("intervene"):
        return

    kind = data.get("kind") or "tone"
    target = data.get("target") or "both"
    await db.coach_nudges.insert_one({
        "room_id": room_id,
        "kind": kind,
        "nudge": str(data.get("nudge", ""))[:200],
        "target": target,
        "created_at": now.isoformat(),
    })
    await db.rooms.update_one({"room_id": room_id}, {"$set": {"coach_last_emit_at": now.isoformat()}})

    # Persist against the flagged debater(s) so a one-off nudge becomes a
    # real, visible-over-time signal instead of being thrown away after the
    # in-room toast/poll cycle (previously nothing outside coach_nudges ever
    # read this back). Only the two ORIGINAL primaries — a party partner or
    # a later-approved joiner was never who "target": "a"/"b" meant here.
    target_user_ids = []
    if target in ("a", "both") and room.get("user_a"):
        target_user_ids.append(room["user_a"])
    if target in ("b", "both") and room.get("user_b"):
        target_user_ids.append(room["user_b"])
    for uid in target_user_ids:
        await db.users.update_one({"user_id": uid}, {"$inc": {f"coach_flags.{kind}": 1}})


TOPIC_DRIFT_SYSTEM = (
    "You classify the CURRENT subject of a live conversation. Read the recent transcript "
    "and decide which single category from this fixed list the participants are actually "
    f"talking about right now: {CATEGORIES}. "
    "Judge the real subject, not word associations — a passing mention doesn't count. "
    'Return ONLY JSON: {"category": "<one exact value from the list>"}. No prose, no markdown.'
)
TOPIC_DRIFT_SUSTAIN_SECONDS = 10 * 60  # client brief #2: 10 minutes sustained before it counts


async def maybe_detect_topic_drift(room_id: str, room: dict):
    """Companion to maybe_run_coach, same inline-on-chat-message trigger shape
    (own counter, independent of the coach's). Tracks a rolling "what are they
    actually talking about" candidate on the room doc; only once the SAME
    category has been the classified subject continuously for 10+ minutes does
    it get added to rooms.categories — a topic mentioned in passing, or one the
    conversation drifts through quickly, never sticks (client brief #2).
    """
    count = room.get("topic_msg_count", 0) + 1
    if count < 5:
        await db.rooms.update_one({"room_id": room_id}, {"$set": {"topic_msg_count": count}})
        return
    await db.rooms.update_one({"room_id": room_id}, {"$set": {"topic_msg_count": 0}})

    msgs = await db.chat_messages.find({"room_id": room_id}, {"_id": 0}).sort("created_at", -1).to_list(12)
    if not msgs:
        return
    msgs.reverse()
    transcript = "\n".join(m["text"] for m in msgs)
    data = await call_gemini_json(TOPIC_DRIFT_SYSTEM, f"Recent transcript:\n{transcript}", session_id=f"topicdrift-{room_id}")
    if not data:
        return
    category = data.get("category")
    if category not in CATEGORIES:
        return

    now = datetime.now(timezone.utc)
    existing_categories = room.get("categories") or []
    if category in existing_categories:
        return  # already tagged, nothing to track

    candidate = room.get("topic_drift_candidate")
    since = room.get("topic_drift_since")
    if candidate != category or not since:
        # New candidate (or the first ever) — start the 10-minute clock over.
        await db.rooms.update_one({"room_id": room_id}, {"$set": {
            "topic_drift_candidate": category,
            "topic_drift_since": now.isoformat(),
        }})
        return

    since_dt = datetime.fromisoformat(since)
    if (now - since_dt).total_seconds() >= TOPIC_DRIFT_SUSTAIN_SECONDS:
        await db.rooms.update_one({"room_id": room_id}, {
            "$addToSet": {"categories": category},
            "$set": {"topic_drift_candidate": None, "topic_drift_since": None},
        })
