# Indifferent

Pairs users with opposing views for live video/text debate. React (CRA) frontend, FastAPI backend, MongoDB.

## Structure

Two independently-deployed halves in this one repo:

- `frontend/` — React 19 + CRA/craco + Tailwind + shadcn. Deployed as its own Vercel project (Root Directory: `frontend`).
- `backend/` — FastAPI, deployed as a single Vercel serverless function (`api/index.py`, Root Directory: `backend`). No persistent process, so realtime features (chat, the AI debate coach, spectator comments/likes) are REST polling rather than WebSockets — see `backend/app/routers/rooms.py` and `routers/public.py`.

Pushing to `main` auto-deploys both Vercel projects.

## Local development

Prerequisites: [uv](https://docs.astral.sh/uv/), Node 22+ with Yarn 1, and a local MongoDB on `mongodb://localhost:27017` (MongoDB Community Server; on Windows `winget install MongoDB.Server` installs it as a service).

Backend (Python 3.12, from the same `uv.lock` Vercel deploys):
```
cd backend
uv sync --frozen
uv pip install -r requirements-dev.txt
cp .env.example .env   # set MONGO_URL=mongodb://localhost:27017, DB_NAME=indifferent_dev, CORS_ORIGINS=http://localhost:3000
uv run --frozen uvicorn server:app --reload --port 8000
```

Frontend:
```
cd frontend
yarn install
cp .env.example .env   # REACT_APP_BACKEND_URL=http://localhost:8000
yarn start
```

Signing in locally needs a Google OAuth client with `http://localhost:3000` and `http://localhost:3000/auth/callback` registered. Without one, logged-out pages still work. `ENABLE_VISUAL_EDITS=true` re-enables the Emergent visual-edits dev plugin (off by default: it breaks compilation of `ClaimTreeView.jsx`).

## Tests

```
cd backend && uv run --frozen pytest        # needs local MongoDB; refuses to run against a remote DB
cd frontend && yarn test --watchAll=false
```

Backend tests use a throwaway `indifferent_test_*` database per worker and force every third-party integration off (no Groq, LiveKit, Stripe or Blob calls). GitHub Actions runs both suites on every push to `main` and every pull request (`.github/workflows/tests.yml`).

## Required environment variables

See `backend/.env.example` and `frontend/.env.example` for the full list. At minimum, nothing works end-to-end without:

- `MONGO_URL` / `DB_NAME` — MongoDB Atlas connection string
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` (backend) + `REACT_APP_GOOGLE_CLIENT_ID` (frontend) — a Google OAuth client (console.cloud.google.com/apis/credentials), with both origins and `<origin>/auth/callback` registered
- `GROQ_API_KEY` — console.groq.com/keys (AI features fall back to canned prompts when unset)

Optional: `LIVEKIT_*` (video), `STRIPE_*` (payments) — both degrade to a clean 503 when unset rather than crashing.

On Vercel, set these as each project's Environment Variables (dashboard → Settings), not in a committed `.env` file.

## Database indexes

Locally, the backend creates its MongoDB indexes on startup. On Vercel it doesn't (startup runs on every serverless cold start, and the ~55 sequential index calls made first requests take seconds), so **whenever `create_indexes` in `backend/app/db.py` changes, run this once against production**:

```
cd backend
MONGO_URL="<production connection string>" DB_NAME="<production db name>" uv run --frozen python -m scripts.setup_db
```

It's safe to re-run. `DB_SETUP_ON_STARTUP=true|false` overrides the default in either environment.
