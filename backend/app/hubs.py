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

from .db import db
from .llm import call_gemini_json

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
        f"{'A' if m['sender_id'] == room['user_a'] else 'B'}: {m['text']}" for m in msgs
    )
    data = await call_gemini_json(COACH_SYSTEM, f"Recent transcript:\n{transcript}", session_id=f"coach-{room_id}")
    if not data or not data.get("intervene"):
        return

    await db.coach_nudges.insert_one({
        "room_id": room_id,
        "kind": data.get("kind") or "tone",
        "nudge": str(data.get("nudge", ""))[:200],
        "target": data.get("target") or "both",
        "created_at": now.isoformat(),
    })
    await db.rooms.update_one({"room_id": room_id}, {"$set": {"coach_last_emit_at": now.isoformat()}})
