"""Indifferent — API entrypoint.

Pairs users with opposing views for live video/text debate, now generalized
beyond politics-only. This file just wires the app together: CORS, router
mounts, startup/shutdown. Deployed on Vercel as a single serverless function
(see api/index.py + vercel.json) — no persistent process, so realtime features
(chat, coach nudges, spectator comments/likes/count) are REST polling, not
WebSockets; see routers/rooms.py and routers/public.py.

Implementation lives in app/:
  db.py       Motor client + index creation
  config.py   env-driven settings (.env loading happens here)
  deps.py     get_current_user auth dependency
  models.py   Pydantic models
  llm.py      LLM integration (Groq, via the official groq SDK)
  storage.py  Vercel Blob object storage (clip uploads, ID-verification docs)
  hubs.py     the AI debate coach (stateless, DB-backed — see its docstring)
  categories.py  fixed broad category list
  routers/    one module per REST feature area
"""
import logging

from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware

from app.config import CORS_ORIGINS
from app.db import client, create_indexes
from app.routers import admin, auth, categories, clips, friends, health, livekit, match, notifications, onboarding, payments, private, profiles, public, reports, rooms, verify
from app.storage import init_storage

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("indifferent")

app = FastAPI(title="Indifferent API")

for module in (health, auth, onboarding, verify, match, rooms, public, livekit, categories, payments, profiles, friends, private, clips, reports, notifications, admin):
    app.include_router(module.router, prefix="/api")

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    # Wildcard + credentials is invalid per the CORS spec — browsers reject
    # it outright, which is exactly what happens if CORS_ORIGINS is ever
    # unset (a new environment, an accidentally-cleared var): every request
    # fails auth with nothing but an opaque browser network error to go on.
    # Defaulting to localhost instead keeps local dev working out of the box
    # while making a missing var in any real deployment fail loudly and
    # immediately (every cross-origin request blocked) rather than silently.
    allow_origins=CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    try:
        init_storage()
    except Exception as e:
        # Same reasoning as the create_indexes guard below: a storage backend
        # hiccup (e.g. an unwritable path) shouldn't take down every endpoint,
        # including ones that never touch storage at all.
        logger.error(f"init_storage failed at startup, continuing without it: {e}")
    try:
        await create_indexes()
    except Exception as e:
        # Don't let a transient Atlas hiccup at cold-start take down every
        # endpoint (including ones that don't even touch the DB) — indexes
        # are a perf/integrity nicety, not something request handling should
        # be gated on. This matters more on serverless than it did on a
        # persistent server: cold starts (and so this handler) run far more
        # often than "once, at process boot."
        logger.error(f"create_indexes failed at startup, continuing without them: {e}")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
