"""Vercel Blob-backed object storage for uploaded media (Claim Trees clips,
ID-verification documents) — public, persistent storage. Replaces an
interim local-disk implementation that silently lost data in production:
on Vercel serverless, writes to local disk land in an ephemeral /tmp that
does not persist across cold starts and isn't shared between concurrent
instances, so a file could vanish before it was ever read back. Confirmed
happening for real — a genuine user's uploaded Claim Trees clip 404'd
within hours of being posted.

Callers must treat the `url` in put_object()'s return value as the durable
reference, not the `path` they passed in — Blob storage appends its own
suffix to the actual stored pathname, so the requested path alone can't be
used to reconstruct where the object really lives.
"""
import logging
import os

import requests
from fastapi import HTTPException

logger = logging.getLogger("indifferent")

BLOB_API_URL = "https://blob.vercel-storage.com"


def _token() -> str:
    token = os.environ.get("BLOB_READ_WRITE_TOKEN", "")
    if not token:
        raise HTTPException(status_code=503, detail="Upload storage not configured")
    return token


def init_storage(force: bool = False):
    """Nothing to initialize for Vercel Blob (no local directory to create) —
    kept as a no-op so server.py's startup hook has a single thing to call
    regardless of which storage backend is configured."""
    return "vercel-blob"


def put_object(path: str, data: bytes, content_type: str) -> dict:
    resp = requests.put(
        f"{BLOB_API_URL}/{path}",
        data=data,
        headers={
            "authorization": f"Bearer {_token()}",
            "x-api-version": "7",
            "x-content-type": content_type or "application/octet-stream",
        },
        timeout=30,
    )
    if resp.status_code >= 400:
        logger.error(f"Blob upload failed ({resp.status_code}): {resp.text[:300]}")
        raise HTTPException(status_code=502, detail="Upload failed — try again")
    return {"path": path, "url": resp.json()["url"]}
