# Indifferent

Pairs users with opposing views for live video/text debate. React (CRA) frontend, FastAPI backend, MongoDB.

## Structure

Two independently-deployed halves in this one repo:

- `frontend/` — React 19 + CRA/craco + Tailwind + shadcn. Deployed as its own Vercel project (Root Directory: `frontend`).
- `backend/` — FastAPI, deployed as a single Vercel serverless function (`api/index.py`, Root Directory: `backend`). No persistent process, so realtime features (chat, the AI debate coach, spectator comments/likes) are REST polling rather than WebSockets — see `backend/app/routers/rooms.py` and `routers/public.py`.

Pushing to `main` auto-deploys both Vercel projects.

## Local development

Backend:
```
cd backend
python -m venv venv && ./venv/Scripts/activate  # or source venv/bin/activate
pip install -r requirements.txt -r requirements-dev.txt
cp .env.example .env   # fill in real values
uvicorn server:app --reload --port 8000
```

Frontend:
```
cd frontend
yarn install
cp .env.example .env   # fill in real values
yarn start
```

## Required environment variables

See `backend/.env.example` and `frontend/.env.example` for the full list. At minimum, nothing works end-to-end without:

- `MONGO_URL` / `DB_NAME` — MongoDB Atlas connection string
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` (backend) + `REACT_APP_GOOGLE_CLIENT_ID` (frontend) — a Google OAuth client (console.cloud.google.com/apis/credentials), with both origins and `<origin>/auth/callback` registered
- `GEMINI_API_KEY` — aistudio.google.com/apikey

Optional: `LIVEKIT_*` (video), `STRIPE_*` (payments) — both degrade to a clean 503 when unset rather than crashing.

On Vercel, set these as each project's Environment Variables (dashboard → Settings), not in a committed `.env` file.
