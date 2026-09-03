# Indifferent — PRD

## Original Problem Statement
> Omegle-type app and website that pairs users with other users with differentiating views on politics and contemporary issues. The app would integrate AI to listen to the users' conversations and put them in categories, the app would then use the information to find an opposition for the customer. The app would be called Indifferent.

## Current Architecture (2026-09)
- **Frontend**: React 19 (CRA + craco), Tailwind + Shadcn UI primitives, editorial brutalist theme. Hosted on Vercel.
- **Backend**: FastAPI + Motor (async MongoDB), all routes prefixed `/api`. Deployed on Vercel as a Python serverless function — build/deploy is driven by `backend/pyproject.toml` + `backend/uv.lock` via `uv` (NOT `requirements.txt`, which is dev-convenience only and can drift out of sync with what's actually deployed).
- **Auth**: Direct Google OAuth (`routers/auth.py`) — first-party session cookie (`samesite=none` in production so it survives cross-origin `<img>`/`<a>` loads) plus a Bearer-token fallback for Safari/iOS ITP. No third-party auth proxy.
- **AI**: Groq (`app/llm.py`), OpenAI-compatible chat-completions API, `openai/gpt-oss-120b` by default. Powers debate-prompt generation, tag-based onboarding questions, and free-text tag-stance analysis. Model catalogs shift on Groq — verify via `client.models.list()` before assuming a model string still resolves.
- **Realtime**: LiveKit (`routers/livekit.py`, `app/hubs.py`) for video/audio in debate rooms and private calls — not raw WebRTC signaling. The rest of the app (chat, votes, reactions, spectator counts) is REST polling, not WebSockets; there are no `@router.websocket` routes anywhere in the backend.
- **Storage**: Vercel Blob (`app/storage.py`) for clip video uploads and ID-verification documents — public URLs for clips, backend-proxied (never exposed directly) for verification docs. Local disk is never used for user uploads (Vercel's serverless filesystem is ephemeral and previously caused real data loss).
- **Payments**: Stripe (`routers/payments.py`) — membership subscription checkout (`subscriptions_debater` collection tracks status).
- **Admin**: `routers/admin.py` + `/admin` frontend page, gated by an `ADMIN_EMAILS` allowlist; a computed `is_admin` flag on `/auth/me` (not stored on the `User` model, to avoid it leaking into other users' profile responses) drives the nav entry point.

## Core Data Model (MongoDB collections, see `app/db.py`)
`users`, `user_sessions`, `match_queue` / `party_match_queue`, `pending_rooms`, `rooms`, `chat_messages`, `coach_nudges`, `spectator_comments`, `spectator_heartbeats`, `room_reactions`, `room_join_requests`, `room_kick_votes`, `topic_stances` / `topic_stance_history`, `follows`, `friendships`, `subscriptions_debater`, `debate_votes`, `private_messages`, `private_calls`, `clips` / `clip_reactions`, `debate_recordings`, `feedback`, `reports`, `rate_limits`, `notifications`.

## What's Been Implemented
- **Onboarding**: tag-based (pick topics you care about, including custom tags), not a fixed political quiz — Groq generates per-tag Likert-style questions and analyzes free-text stance.
- **Matchmaking**: 1:1 and party-queue (friends queuing together, up to 2 per side), opposition scoring against tag stances.
- **Debate rooms**: LiveKit video/audio, text chat, live coach nudges + topic-drift detection (`app/hubs.py`), join requests for public rooms, kick voting (with retraction).
- **Public watch/spectate**: public debate feed (`/`, `routers/public.py`), live/ended debate viewing, likes/dislikes, audience voting, spectator comments, search (topics/categories/custom title).
- **Group debates and monetization are both fully built** — no longer out of scope.
- **Clips**: claim-tree clip creation/browsing/reactions from debate recordings, backed by Vercel Blob.
- **Private**: friend-to-friend private chat + private LiveKit call, structurally isolated from the AI coach (this file has no Groq call site at all, by design — not a flag someone could flip).
- **Profiles**: public profile pages, follow/friend graph, per-tag stance display.
- **ID verification**: upload → Vercel Blob → admin review queue (`/admin`) with an admin-only document-viewing endpoint (backend-proxied, session-cookie-gated); `VERIFY_AUTO_APPROVE` env flag for auto-approving in dev/testing.
- **Reports & moderation**: user-submitted reports (`routers/reports.py`), admin review queue.
- **Notifications**: in-app notification feed (`routers/notifications.py`).

## Known Gaps (from the 2026-09 redundancy/incompleteness audit)
- Admin portal: no suspend/ban (only permanent delete or a no-op flag), no inline report-content preview for chat/comment report types, no analytics, no payments visibility, no audit log of admin actions, no force-end-room/remove-clip.
- CSRF guard (`require_xhr`) is applied inconsistently across body-less mutating POST endpoints.
- No TURN server — LiveKit's own infra handles this rather than raw STUN-only WebRTC, but NAT traversal at scale hasn't been load-tested.
- No automated test suite currently in the repo (the previous one targeted WebSocket endpoints that no longer exist and had silently rotted with nothing running it in CI).

## Non-goals
- Native mobile app (React Native/Expo) — web-only for now.
