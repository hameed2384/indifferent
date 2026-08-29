from motor.motor_asyncio import AsyncIOMotorClient

from .config import DB_NAME, MONGO_URL

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]


async def create_indexes():
    await db.users.create_index("user_id", unique=True)
    await db.users.create_index("email", unique=True)
    await db.user_sessions.create_index("session_token", unique=True)
    await db.match_queue.create_index("user_id", unique=True)
    await db.rooms.create_index("room_id", unique=True)
    # Generalized per-topic stance model (see models.TopicStance) — one row per
    # (user, topic), topic being e.g. "Politics: Economic" or "Anime".
    await db.topic_stances.create_index([("user_id", 1), ("topic", 1)], unique=True)

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
