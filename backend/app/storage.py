"""Local filesystem storage for ID-verification uploads — interim implementation.

Swap for real cloud object storage (S3/R2/etc.) before this handles production
traffic; put_object/get_object is the seam that swap goes behind, so no router
code needs to change when that day comes.
"""
import logging
from pathlib import Path
from typing import Optional, Tuple

from fastapi import HTTPException

from .config import STORAGE_DIR

logger = logging.getLogger("indifferent")


def init_storage(force: bool = False) -> Optional[str]:
    """Local storage needs no handshake/init call, unlike the old Emergent
    proxy — this just ensures the upload directory exists. Kept as a function
    so server.py's startup hook has a single thing to call regardless of which
    storage backend is configured."""
    Path(STORAGE_DIR).mkdir(parents=True, exist_ok=True)
    return "local"


def put_object(path: str, data: bytes, content_type: str) -> dict:
    dest = Path(STORAGE_DIR) / path
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(data)
    return {"path": path}


def get_object(path: str) -> Tuple[bytes, str]:
    dest = Path(STORAGE_DIR) / path
    if not dest.is_file():
        raise HTTPException(status_code=404, detail="Object not found")
    # Content-type isn't persisted separately in this interim implementation —
    # add a sidecar (or a real object-storage backend, which stores it natively)
    # before anything depends on getting the exact original mime type back.
    return dest.read_bytes(), "application/octet-stream"
