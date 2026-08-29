from typing import Dict, List, Optional

from pydantic import BaseModel


class StanceScores(BaseModel):
    """Two-axis political stance model. Range: -10 (progressive/left) to +10 (conservative/right)."""
    economic: float = 0.0
    social: float = 0.0
    summary: str = ""
    tags: List[str] = []


class User(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    display_name: Optional[str] = None
    bio: Optional[str] = None
    stance: Optional[StanceScores] = None
    onboarded: bool = False
    id_verified: bool = False
    verification_status: str = "unstarted"  # unstarted, pending, verified, rejected
    debates: int = 0
    minds_changed: int = 0
    is_debater: bool = False
    allow_friend_requests: bool = True
    created_at: str


class OnboardingSubmit(BaseModel):
    free_text: Optional[str] = ""
    quiz_answers: Optional[Dict[str, int]] = {}  # question_id -> 1..5 (Likert)
    display_name: Optional[str] = None
    bio: Optional[str] = None


class ChatMessage(BaseModel):
    room_id: str
    sender_id: str
    text: str


class MatchFeedback(BaseModel):
    room_id: str
    rating: int  # 1-5
    mind_changed: bool
    notes: Optional[str] = ""


class SpectatorComment(BaseModel):
    text: str
    display_name: Optional[str] = None


class GoLiveRequest(BaseModel):
    category: str


class ArchiveVisibility(BaseModel):
    visibility: str  # "private" | "unlisted" | "public"


class TopicStance(BaseModel):
    """Per-(user, topic) position, generalizing StanceScores to any category.

    Politics keeps writing the legacy `User.stance` field unchanged, and mirrors
    into two rows here (topic="Politics: Economic" / "Politics: Social") so the
    profile UI can render every topic — political or not — as one spectrum list
    instead of a one-off two-axis square map.
    """
    user_id: str
    topic: str
    category: str
    position: float = 0.0  # -10..10
    summary: str = ""
    tags: List[str] = []
    sample_count: int = 0
    updated_at: str
