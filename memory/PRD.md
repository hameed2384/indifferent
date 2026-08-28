# Indifferent — PRD

## Original Problem Statement
> Omegle-type app and website that pairs users with other users with differentiating views on politics and contemporary issues. The app would integrate AI to listen to the users' conversations and put them in categories, the app would then use the information to find an opposition for the customer. The app would be called Indifferent.

## User Choices Confirmed (2026-02)
- Real-time chat: **Video + text via WebRTC**
- AI stance model: **Gemini 3.1 Pro** (via Emergent Universal Key)
- Onboarding: **Political stance quiz + free-text views** (both, AI-blended)
- Auth: **Emergent-managed Google social login**
- Anonymity: **Profile required + ID verification essential**

## Architecture
- **Frontend**: React 19 (CRA), Tailwind + Shadcn UI primitives (radius=0), Playfair Display + IBM Plex Sans/Mono fonts, editorial brutalist theme.
- **Backend**: FastAPI + Motor (async MongoDB). All routes prefixed `/api`.
- **DB**: MongoDB collections — `users`, `user_sessions`, `match_queue`, `rooms`, `pending_rooms`, `chat_messages`, `feedback`.
- **AI**: `emergentintegrations` → Gemini `gemini-3.1-pro-preview`. Blended score = 60% free-text AI + 40% quiz Likert projection onto (economic, social) axes ∈ [-10, 10].
- **Storage**: Emergent Object Storage for ID docs (path `indifferent/verify/{user_id}/{uuid}.{ext}`).
- **WebRTC**: Browser peer connections with Google STUN servers; FastAPI WebSocket at `/api/ws/room/{room_id}` for signaling + text chat.

## Core User Personas
1. **The Progressive** — economic left, social liberal, wants to be challenged on trade-offs.
2. **The Traditionalist** — economic right, social conservative, wants to be heard by the other side.
3. **The Curious Centrist** — mixed axes, wants to sharpen positions against opposites.

## What's Been Implemented (2026-02)
- **Auth**: Emergent Google OAuth end-to-end; session cookie + Bearer header; `/api/auth/me`, `/auth/session`, `/auth/logout`, `/auth/ws-ticket`.
- **Onboarding**: 8-question Likert quiz + free-text; Gemini analyzes and returns `{economic, social, summary, tags}`.
- **ID Verification**: Emergent Object Storage upload — MOCKED auto-approval (human review deferred).
- **Matchmaking**: Opposition score = |Δeconomic| + |Δsocial|. Best-of-queue selection; poll fallback for waiter.
- **Room + WebRTC**: Signaling for offer/answer/ICE; text-chat broadcast; AI-generated debate prompts per pair.
- **Post-debate feedback**: 1-5 rating, mind-changed flag, notes → `debates` / `minds_changed` counters.
- **Dashboard**: Stance map (two-axis dot), stats, AI summary quote, matched by design guidelines.
- **Frontend routing**: Landing → OAuth callback → Onboarding → Verify → Dashboard → Match → Room.

## Backlog (Prioritized)
- **P1**: Real human ID review workflow (replace MOCKED auto-approve). Admin dashboard for moderation.
- **P1**: Real-time transcript & mid-debate stance refinement (Gemini live commentary).
- **P2**: TURN server for NAT traversal beyond STUN (needed for prod at scale).
- **P2**: Public leaderboard of "minds changed" (opt-in) — shareability lever.
- **P2**: Debate replay + shareable clip cards.
- **P2**: Report & block system, cooldowns for bad actors.
- **P3**: Native mobile app (React Native/Expo).

## Non-goals (for MVP)
- Group debates (>2 people)
- Public forums or feeds
- Monetization / subscriptions
