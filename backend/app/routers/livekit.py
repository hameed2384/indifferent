import uuid
from datetime import timedelta
from typing import Dict

from fastapi import APIRouter, Depends, HTTPException
from livekit import api as lk_api

from ..config import LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_URL
from ..db import db
from ..deps import get_current_user
from ..models import User
from ..room_utils import is_participant

router = APIRouter()


def _mint_livekit_token(identity: str, name: str, room_id: str, *, can_publish: bool) -> str:
    grants = lk_api.VideoGrants(
        room_join=True,
        room=room_id,
        can_publish=can_publish,
        can_subscribe=True,
        can_publish_data=can_publish,
        can_publish_sources=["camera", "microphone"] if can_publish else [],
    )
    at = (
        lk_api.AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
        .with_ttl(timedelta(hours=2))
        .with_identity(identity)
        .with_name(name)
        .with_grants(grants)
    )
    return at.to_jwt()


@router.post("/livekit/participant-token")
async def livekit_participant_token(payload: Dict[str, str], user: User = Depends(get_current_user)):
    room_id = str(payload.get("room_id") or "")
    room = await db.rooms.find_one({"room_id": room_id}, {"_id": 0})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    if not is_participant(room, user.user_id):
        raise HTTPException(status_code=403, detail="Not a participant")
    if not (LIVEKIT_URL and LIVEKIT_API_KEY and LIVEKIT_API_SECRET):
        raise HTTPException(status_code=503, detail="LiveKit not configured")
    token = _mint_livekit_token(
        identity=f"user-{user.user_id}",
        name=user.display_name or user.name,
        room_id=room_id,
        can_publish=True,
    )
    return {"server_url": LIVEKIT_URL, "participant_token": token}


@router.post("/livekit/spectator-token")
async def livekit_spectator_token(payload: Dict[str, str]):
    room_id = str(payload.get("room_id") or "")
    r = await db.rooms.find_one({"room_id": room_id, "is_public": True}, {"_id": 0})
    if not r:
        raise HTTPException(status_code=404, detail="Room not public")
    if not (LIVEKIT_URL and LIVEKIT_API_KEY and LIVEKIT_API_SECRET):
        raise HTTPException(status_code=503, detail="LiveKit not configured")
    token = _mint_livekit_token(
        identity=f"spectator-{uuid.uuid4().hex[:10]}",
        name="Spectator",
        room_id=room_id,
        can_publish=False,
    )
    return {"server_url": LIVEKIT_URL, "participant_token": token}
