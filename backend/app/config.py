"""Centralized env-driven configuration. Every other module reads settings from
here rather than touching os.environ directly, so there's one place that knows
about .env loading order and defaults.
"""
import os
from pathlib import Path

from dotenv import load_dotenv

ROOT_DIR = Path(__file__).resolve().parent.parent
load_dotenv(ROOT_DIR / ".env")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]

APP_NAME = os.environ.get("APP_NAME", "indifferent")
FRONTEND_URL = os.environ.get("FRONTEND_URL", "")

# Cookies: real prod (frontend/backend on different HTTPS domains) needs
# Secure+SameSite=None for the session cookie to be sent cross-site at all.
# Plain-http local dev can't set a Secure cookie, so flip this off there —
# SameSite=Lax still works for localhost:3000 <-> localhost:8000 since they're
# same-site (SameSite only cares about the registrable domain, not the port).
COOKIE_SECURE = os.environ.get("COOKIE_SECURE", "true").strip().lower() == "true"

# Google OAuth (direct — replaces the old Emergent-managed auth proxy).
# Create a client at https://console.cloud.google.com/apis/credentials
# (OAuth client ID, type "Web application"), add both your frontend's
# origin (Authorized JavaScript origins) and FRONTEND_URL + "/auth/callback"
# (Authorized redirect URIs). Client ID is public (also read by the frontend
# via REACT_APP_GOOGLE_CLIENT_ID); the secret must only ever live here.
GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET", "")
GOOGLE_REDIRECT_URI = os.environ.get("GOOGLE_REDIRECT_URI", "")

# Groq (fast, generous free tier, no credit card — replaces the earlier
# direct Gemini integration, which kept 503ing "high demand" on a
# newly-launched free-tier Flash model). Key from https://console.groq.com/keys.
# Model catalogs shift on Groq — llama-3.3-70b-versatile (the well-known
# default as of this integration) had already been retired by the time this
# key was tested; confirm what's actually live for your key via
# client.models.list() before assuming a model string still resolves.
# openai/gpt-oss-120b confirmed working and good quality as of Sept 2026.
GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")
GROQ_MODEL = os.environ.get("GROQ_MODEL", "openai/gpt-oss-120b")

LIVEKIT_URL = os.environ.get("LIVEKIT_URL", "")
LIVEKIT_API_KEY = os.environ.get("LIVEKIT_API_KEY", "")
LIVEKIT_API_SECRET = os.environ.get("LIVEKIT_API_SECRET", "")

# Stripe — two separate products (see routers/payments.py): a £9/mo site-wide
# membership (not called a "subscription" — that word is reserved for the
# £2/mo per-debater one) and a £2/mo per-debater subscription. Empty by
# default; endpoints 503 until real keys/price ids are set, same convention
# as LiveKit above.
STRIPE_SECRET_KEY = os.environ.get("STRIPE_SECRET_KEY", "")
STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET", "")
STRIPE_PRICE_ID_MEMBERSHIP = os.environ.get("STRIPE_PRICE_ID_MEMBERSHIP", "")
STRIPE_PRICE_ID_DEBATER = os.environ.get("STRIPE_PRICE_ID_DEBATER", "")

# Trust & safety. Real manual-review infrastructure exists now (see
# routers/verify.py: a pending queue + admin decide endpoint), but defaults
# to auto-approve — the exact behavior this replaces — so a fresh deploy
# doesn't silently lock every new signup out of matchmaking the moment
# nobody's watching the admin queue. Flip to "false" once ready to actually
# review submissions by hand.
VERIFY_AUTO_APPROVE = os.environ.get("VERIFY_AUTO_APPROVE", "true").strip().lower() == "true"

# Emails allowed to hit moderator-only endpoints (the verification review
# queue for now). No real role system exists yet — this is the lightest
# gate that doesn't require building one. Defaults to the project owner's
# own email so it works with zero extra config.
ADMIN_EMAILS = {e.strip().lower() for e in os.environ.get("ADMIN_EMAILS", "rehman2384@gmail.com").split(",") if e.strip()}
