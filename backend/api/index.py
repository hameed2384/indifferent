"""Vercel entry point. This project's Vercel "Root Directory" must be set to
`backend/` — Vercel's Python builder then treats this whole directory as the
function's package, so `server` and `app/` resolve as normal sibling imports.

If the build ever fails to find the `app` package, check the project's
Root Directory setting first — that's the usual cause, not this file.
"""
from server import app  # noqa: F401
