"""Shared test setup.

Tests run against a REAL MongoDB, but only a local one: the env vars below are
set before `app` is imported (app/config.py reads them at import time, and
load_dotenv never overrides a var that's already set), and `_assert_local_db`
refuses to run if TEST_MONGO_URL points anywhere other than this machine.
That matters because startup code (create_indexes, _dedupe_room_reactions)
writes to whatever database it's given.

Each pytest-xdist worker gets its own database (indifferent_test_gw0, ...), and
every test starts with all collections emptied.

All third-party integrations are forced off so tests are offline and
deterministic: no Groq key (llm.py falls back to canned prompts), no LiveKit,
Stripe or Vercel Blob (those endpoints return 503).
"""
import os
import uuid
from datetime import datetime, timedelta, timezone
from urllib.parse import urlparse

import pytest

TEST_MONGO_URL = os.environ.get("TEST_MONGO_URL", "mongodb://localhost:27017")
_WORKER = os.environ.get("PYTEST_XDIST_WORKER", "main")
ADMIN_EMAIL = "admin@test.local"


def _assert_local_db(url: str) -> None:
    host = urlparse(url).hostname or ""
    if url.startswith("mongodb+srv://") or host not in {"localhost", "127.0.0.1", "::1"}:
        raise RuntimeError(
            f"Refusing to run tests against non-local MongoDB ({host or url!r}). "
            "Set TEST_MONGO_URL to a local instance, e.g. mongodb://localhost:27017"
        )


_assert_local_db(TEST_MONGO_URL)

os.environ.update({
    "MONGO_URL": TEST_MONGO_URL,
    "DB_NAME": f"indifferent_test_{_WORKER}",
    "CORS_ORIGINS": "http://localhost:3000",
    "FRONTEND_URL": "http://localhost:3000",
    "COOKIE_SECURE": "false",
    "ADMIN_EMAILS": ADMIN_EMAIL,
    "VERIFY_AUTO_APPROVE": "true",
    "GOOGLE_CLIENT_ID": "",
    "GOOGLE_CLIENT_SECRET": "",
    "GROQ_API_KEY": "",
    "LIVEKIT_URL": "",
    "LIVEKIT_API_KEY": "",
    "LIVEKIT_API_SECRET": "",
    "STRIPE_SECRET_KEY": "",
    "STRIPE_WEBHOOK_SECRET": "",
    "STRIPE_PRICE_ID_MEMBERSHIP": "",
    "STRIPE_PRICE_ID_DEBATER": "",
    "BLOB_READ_WRITE_TOKEN": "",
})

import httpx  # noqa: E402
from app.db import client as mongo_client, create_indexes, db  # noqa: E402
from server import app  # noqa: E402

assert db.name.startswith("indifferent_test_"), db.name


@pytest.fixture(scope="session", autouse=True)
async def _database():
    await mongo_client.drop_database(db.name)
    await create_indexes()
    yield
    await mongo_client.drop_database(db.name)


@pytest.fixture(autouse=True)
async def _clean_collections(_database):
    for name in await db.list_collection_names():
        await db[name].delete_many({})
    yield


@pytest.fixture
async def client():
    """HTTP client wired straight into the FastAPI app (no server process).
    Sends X-Requested-With by default, like the real frontend (lib/api.js)."""
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(
        transport=transport, base_url="http://test", headers={"X-Requested-With": "XMLHttpRequest"}
    ) as c:
        yield c


@pytest.fixture
def make_user():
    """Create a user plus a valid session; returns (user_doc, auth_headers).

    make_user(onboarded=True, id_verified=True, interest_tags=["cats"],
              stances={"cats": 8.0})
    `stances` writes topic_stances rows (position on the -10..10 scale)."""
    async def _make(*, stances=None, session_expires_in=timedelta(days=7), **fields):
        uid = f"user_{uuid.uuid4().hex[:12]}"
        doc = {
            "user_id": uid,
            "email": f"{uid}@test.local",
            "name": f"Test {uid[-4:]}",
            "created_at": datetime.now(timezone.utc).isoformat(),
            **fields,
        }
        await db.users.insert_one(dict(doc))
        token = f"tok_{uuid.uuid4().hex}"
        await db.user_sessions.insert_one({
            "user_id": uid,
            "session_token": token,
            "expires_at": (datetime.now(timezone.utc) + session_expires_in).isoformat(),
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        for topic, position in (stances or {}).items():
            await db.topic_stances.insert_one({
                "user_id": uid, "topic": topic, "category": topic,
                "position": position, "summary": f"{topic} stance {position}",
                "tags": [], "sample_count": 1,
            })
        return doc, {"Authorization": f"Bearer {token}"}

    return _make


@pytest.fixture
def ready_user(make_user):
    """A user who can enter matchmaking: onboarded, verified, with stances."""
    async def _make(stances, **fields):
        return await make_user(
            onboarded=True, id_verified=True, verification_status="verified",
            interest_tags=list(stances), stances=stances, **fields,
        )

    return _make
