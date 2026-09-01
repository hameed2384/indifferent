from motor.motor_asyncio import AsyncIOMotorClient
from pymongo.errors import OperationFailure

from .config import DB_NAME, MONGO_URL

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]


async def _dedupe_room_reactions():
    """One-time cleanup for a room a user managed to both like and dislike
    back when they were independent reactions — keeps whichever is newer,
    deletes the other, and corrects the room's counter to match. Must run
    before create_indexes() tightens room_reactions to one document per
    (room_id, user_id); a no-op once no pair is left to clean up, so it's
    safe to run on every startup rather than as a one-off migration."""
    cursor = db.room_reactions.aggregate([
        {"$group": {"_id": {"room_id": "$room_id", "user_id": "$user_id"}, "docs": {"$push": "$$ROOT"}, "n": {"$sum": 1}}},
        {"$match": {"n": {"$gt": 1}}},
    ])
    async for group in cursor:
        docs = sorted(group["docs"], key=lambda d: d.get("created_at", ""))
        for stale in docs[:-1]:  # keep only the most recently-set reaction
            await db.room_reactions.delete_one({"_id": stale["_id"]})
            await db.rooms.update_one({"room_id": stale["room_id"]}, {"$inc": {f"{stale['kind']}s": -1}})


async def create_indexes():
    await db.users.create_index("user_id", unique=True)
    await db.users.create_index("email", unique=True)
    # Partial (not plain unique): most users won't have set a handle yet, and
    # a plain unique index only tolerates ONE doc missing/null on the field —
    # every user past the first to skip it would fail their next unrelated
    # profile update. The partialFilterExpression scopes uniqueness to only
    # the users who've actually set a string handle.
    await db.users.create_index(
        "handle", unique=True, partialFilterExpression={"handle": {"$type": "string"}}
    )
    await db.user_sessions.create_index("session_token", unique=True)
    await db.match_queue.create_index("user_id", unique=True)
    # Upserted by _create_room() for every non-caller founding member — unique
    # so a race between two concurrent matches for the same user can't leave
    # two pending_rooms docs (only the most recent match should ever win).
    await db.pending_rooms.create_index("user_id", unique=True)
    await db.rooms.create_index("room_id", unique=True)
    # Generalized per-topic stance model (see models.TopicStance) — one row per
    # (user, topic), topic being e.g. "Politics: Economic" or "Anime".
    await db.topic_stances.create_index([("user_id", 1), ("topic", 1)], unique=True)
    # Append-only history behind topic_stances (app/topic_stances.py) — lets a
    # profile show "shifted since you started" instead of only ever a static
    # current value.
    await db.topic_stance_history.create_index([("user_id", 1), ("topic", 1), ("created_at", 1)])

    # Polling-based realtime (see routers/rooms.py, routers/public.py): every
    # client pulls "what's new since <cursor>" scoped to a room, so these are
    # the two shapes every query actually runs.
    await db.chat_messages.create_index([("room_id", 1), ("created_at", 1)])
    await db.coach_nudges.create_index([("room_id", 1), ("created_at", 1)])
    await db.spectator_comments.create_index([("room_id", 1), ("created_at", 1)])
    # "Who's watching right now" without a persistent connection: each poll
    # upserts a heartbeat; spectator_count = live docs for the room. The TTL
    # index expires (and so silently un-counts) anyone who stops polling.
    await db.spectator_heartbeats.create_index([("room_id", 1), ("client_id", 1)], unique=True)
    await db.spectator_heartbeats.create_index("last_seen_at", expireAfterSeconds=45)

    # Discovery/search (routers/public.py list_public_debates).
    await db.rooms.create_index("categories")
    await db.rooms.create_index([("is_public", 1), ("status", 1), ("published_at", -1)])
    await db.rooms.create_index("archive_visibility")

    # Follow graph (routers/profiles.py) — one of three deliberately separate
    # relationship systems (follow/friend/subscribe).
    await db.follows.create_index([("follower_id", 1), ("followee_id", 1)], unique=True)
    await db.follows.create_index("followee_id")

    # Friendships (routers/friends.py) — separate collection from follows, per
    # client brief. Queried by either side of the pair, so index both.
    await db.friendships.create_index([("user_a", 1), ("user_b", 1)], unique=True)
    await db.friendships.create_index("user_b")

    # Debater subscriptions (routers/payments.py) — £2/mo per debater.
    await db.subscriptions_debater.create_index([("subscriber_id", 1), ("debater_id", 1)], unique=True)

    # Group debates (routers/rooms.py) — subscriber-join requests + kick votes
    # only ever hold in-progress docs (resolved ones are deleted immediately),
    # so the unique index doubles as "no duplicate pending request/vote."
    await db.room_join_requests.create_index([("room_id", 1), ("user_id", 1)], unique=True)
    await db.room_kick_votes.create_index([("room_id", 1), ("target_user_id", 1)], unique=True)
    # Party-queue (routers/match.py) — two friends queueing together.
    await db.party_match_queue.create_index("party_id", unique=True)
    await db.party_match_queue.create_index("user_ids")

    # Agree/disagree voting (routers/public.py) — one vote per (room, viewer),
    # changeable, feeding topic_stances via the reasoning text.
    await db.debate_votes.create_index([("room_id", 1), ("user_id", 1)], unique=True)

    # Private friend chat/call (routers/private.py) — isolated from every AI
    # call site by construction, see that module's docstring.
    await db.private_messages.create_index([("pair_key", 1), ("created_at", 1)])
    await db.private_calls.create_index("pair_key", unique=True)

    # Claim Trees (routers/clips.py) — branching async video rebuttals.
    await db.clips.create_index("clip_id", unique=True)
    await db.clips.create_index([("parent_clip_id", 1), ("likes", -1)])
    await db.clips.create_index([("category", 1), ("parent_clip_id", 1), ("created_at", -1)])

    # Post-debate feedback (routers/rooms.py) — write-only for now (rating/
    # notes aren't surfaced anywhere yet; mind_changed's aggregate effect
    # already lands on the user doc directly), kept indexed for whenever a
    # feedback history view gets built.
    await db.feedback.create_index([("user_id", 1), ("created_at", -1)])

    # "Is this person live right now" (room_utils.find_live_room_id) fans out
    # across profiles/friends/follows/subscriptions sidebars — was an
    # unindexed full scan on every one of those.
    await db.rooms.create_index("user_a")
    await db.rooms.create_index("user_b")
    await db.rooms.create_index("extra_a")
    await db.rooms.create_index("extra_b")

    # Per-user reactions (app/reactions.py) — one like/dislike per (item,
    # user, kind); the uniqueness is what makes vote-stuffing impossible,
    # not just a lookup optimization.
    await db.clip_reactions.create_index([("clip_id", 1), ("user_id", 1), ("kind", 1)], unique=True)

    # Debate reactions are like XOR dislike (app/reactions.toggle_reaction),
    # so the index is on (room_id, user_id) alone — NOT including kind, unlike
    # clip_reactions above — enforcing at most one reaction doc per viewer per
    # room. _dedupe_room_reactions must run first: it clears out any doc pairs
    # left over from when a user really could both like and dislike the same
    # room, which would otherwise make this create_index call fail outright.
    await _dedupe_room_reactions()
    try:
        await db.room_reactions.drop_index("room_id_1_user_id_1_kind_1")
    except OperationFailure:
        pass  # already gone — every deploy after the first hits this
    await db.room_reactions.create_index([("room_id", 1), ("user_id", 1)], unique=True)

    # Profile view (routers/profiles.py) counts/lists a user's own clips on
    # every visit; list_root_claims' default (no-category) browse sorts by
    # created_at, which (parent_clip_id, likes) alone can't serve.
    await db.clips.create_index([("uploader_id", 1), ("created_at", -1)])
    await db.clips.create_index([("parent_clip_id", 1), ("created_at", -1)])

    # Trust & safety (routers/reports.py) — one report per (reporter,
    # target) so re-reporting updates in place instead of piling up; open
    # queue sorted oldest-first is the shape a future review UI will want.
    await db.reports.create_index([("reporter_id", 1), ("target_type", 1), ("target_id", 1)], unique=True)
    await db.reports.create_index([("status", 1), ("created_at", 1)])

    # Rate limiting (app/ratelimit.py) — the TTL index is what keeps this
    # collection from growing unbounded; each doc names its own expiry.
    await db.rate_limits.create_index("expires_at", expireAfterSeconds=0)

    # Notification center (app/notifications.py, routers/notifications.py).
    await db.notifications.create_index([("recipient_id", 1), ("created_at", -1)])
    await db.notifications.create_index([("recipient_id", 1), ("read", 1)])
