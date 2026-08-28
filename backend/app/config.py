"""Centralized env-driven configuration. Every other module reads settings from
here rather than touching os.environ directly, so there's one place that knows
about .env loading order and defaults.
"""
import os
import tempfile
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

# Gemini (direct via Google's google-genai SDK — replaces the Emergent LLM proxy).
# Key from https://aistudio.google.com/apikey. Model name is whatever the
# product is designed around (see memory/PRD.md); override if that string
# isn't a valid model id for your key/account.
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-3.1-pro-preview")

LIVEKIT_URL = os.environ.get("LIVEKIT_URL", "")
LIVEKIT_API_KEY = os.environ.get("LIVEKIT_API_KEY", "")
LIVEKIT_API_SECRET = os.environ.get("LIVEKIT_API_SECRET", "")

# ID-verification upload storage. Interim local-disk implementation (see
# storage.py) — swap for real cloud object storage (S3/R2/etc.) before this
# handles production traffic; put_object/get_object is the seam that swap
# goes behind, so no router changes needed when that day comes.
# Default is the OS temp dir, not a path under the app itself: serverless
# platforms (Vercel included) ship the app on a READ-ONLY filesystem — only
# the temp dir is writable, and even that doesn't persist across cold starts.
# tempfile.gettempdir() resolves correctly on both Windows (local dev) and
# Vercel's Linux runtime (/tmp), unlike a hardcoded "/tmp".
STORAGE_DIR = os.environ.get("STORAGE_DIR", "") or str(Path(tempfile.gettempdir()) / "indifferent-uploads")

# Stripe — two separate products (see routers/payments.py): a £9/mo platform
# ad-free subscription and a £2/mo per-debater subscription. Empty by default;
# endpoints 503 until real keys/price ids are set, same convention as LiveKit above.
STRIPE_SECRET_KEY = os.environ.get("STRIPE_SECRET_KEY", "")
STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET", "")
STRIPE_PRICE_ID_PLATFORM = os.environ.get("STRIPE_PRICE_ID_PLATFORM", "")
STRIPE_PRICE_ID_DEBATER = os.environ.get("STRIPE_PRICE_ID_DEBATER", "")
