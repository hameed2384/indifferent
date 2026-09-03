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
    handle: Optional[str] = None  # unique, e.g. "hameed" (displayed as "@hameed") — separate from the non-unique display_name
    bio: Optional[str] = None
    stance: Optional[StanceScores] = None  # legacy 2-axis political field — dead for new-flow users, see interest_tags
    interest_tags: List[str] = []  # up to 3 tags chosen at (new-style) onboarding; gates matchmaking
    onboarded: bool = False
    id_verified: bool = False
    verification_status: str = "unstarted"  # unstarted, pending, verified, rejected
    debates: int = 0
    minds_changed: int = 0
    referral_count: int = 0
    is_debater: bool = False
    allow_friend_requests: bool = True
    ad_free: bool = False
    created_at: str


class LikertQuestion(BaseModel):
    id: str
    tag: str
    text: str
    invert: bool = False


class TagQuestionsRequest(BaseModel):
    tags: List[str]  # 1..3, validated against CATEGORIES in the route


class TagQuestionsResponse(BaseModel):
    questions: List[LikertQuestion]


class OnboardingSubmit(BaseModel):
    tags: List[str] = []  # 1..3, subset of CATEGORIES
    questions: List[LikertQuestion] = []  # echoed back verbatim from /onboarding/questions/generate
    quiz_answers: Optional[Dict[str, int]] = {}  # question_id -> 1..5 (Likert)
    free_text: Optional[str] = ""
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
    title: str  # required — the broadcaster's own words; the one case with a real single decider
    description: Optional[str] = None  # optional longer context, shown only on the watch page


class JoinRequestCreate(BaseModel):
    side: str  # "a" | "b" — which side the subscriber wants to join


class JoinRequestDecision(BaseModel):
    approve: bool


class KickVoteCreate(BaseModel):
    target_user_id: str


class PartyEnqueueRequest(BaseModel):
    friend_id: str


class ArchiveVisibility(BaseModel):
    visibility: str  # "private" | "unlisted" | "public" — only accepts a MORE-private move; see routers/rooms.py

class ArchiveVisibilityRequestIn(BaseModel):
    visibility: str  # the LESS-private state being requested — "unlisted" | "public"

class ArchiveVisibilityDecision(BaseModel):
    approve: bool

class PublishConsent(BaseModel):
    topic_index: Optional[int] = None  # 0/1/2 — this side's preferred pre-generated topic, optional

class RoomInfoUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None

class RoomInviteIn(BaseModel):
    friend_ids: List[str]


class ClipUpdate(BaseModel):
    caption: Optional[str] = None
    unlisted: Optional[bool] = None


class TopicStance(BaseModel):
    """Per-(user, topic) position — the single generalized model onboarding now
    writes one row of per tag chosen (topic == category == the tag itself),
    including Politics, which is no longer special-cased onto the legacy
    `StanceScores`/`User.stance` two-axis fields. Matchmaking reads directly
    from these rows (see topic_stances.py's get_tag_positions/
    shared_tag_opposition). The profile UI renders every row as one spectrum
    list regardless of which tag it's for.
    """
    user_id: str
    topic: str
    category: str
    position: float = 0.0  # -10..10
    summary: str = ""
    tags: List[str] = []
    sample_count: int = 0
    updated_at: str
