"""Account deletion, shared by the admin portal (admin.delete_user) and
self-service deletion (profiles DELETE /users/me).

Removes the account and its identity-linked data so the same email can sign
up fresh (auth.py's new-vs-returning check is keyed on users.email), plus
the personal media that would otherwise outlive it: the ID-verification
document, the person's own debate-recording chunks (their camera and mic),
their AI sparring transcripts, and the video of their claims.

Shared content other people still have a stake in is kept but detached:
past debates (rooms), chat messages and votes stay, and every read site
already degrades to a generic label when the user doc is gone. A claim
with replies is tombstoned (caption "[deleted]", video removed) rather
than hard-deleted, so other users' rebuttals aren't orphaned.
"""
from datetime import datetime, timezone

from .db import db
from .storage import delete_object


async def delete_account(user_id: str) -> dict:
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "verification_doc_url": 1}) or {}
    blobs = []
    if user.get("verification_doc_url"):
        blobs.append(user["verification_doc_url"])

    recordings = await db.debate_recordings.find({"user_id": user_id}, {"_id": 0, "url": 1}).to_list(None)
    blobs += [r["url"] for r in recordings if r.get("url")]
    await db.debate_recordings.delete_many({"user_id": user_id})

    clips_removed = 0
    async for clip in db.clips.find({"uploader_id": user_id}, {"_id": 0}):
        if clip.get("video_url"):
            blobs.append(clip["video_url"])
        if int(clip.get("reply_count", 0)) == 0:
            await db.clips.delete_one({"clip_id": clip["clip_id"]})
            await db.clip_reactions.delete_many({"clip_id": clip["clip_id"]})
            if clip.get("parent_clip_id"):
                await db.clips.update_one({"clip_id": clip["parent_clip_id"]}, {"$inc": {"reply_count": -1}})
        else:
            await db.clips.update_one({"clip_id": clip["clip_id"]}, {"$set": {
                "deleted": True, "caption": "[deleted]", "video_url": None,
                "deleted_at": datetime.now(timezone.utc).isoformat(),
            }})
        clips_removed += 1

    spar_ids = [d["debate_id"] for d in await db.ai_debates.find({"user_id": user_id}, {"_id": 0, "debate_id": 1}).to_list(None)]
    await db.ai_debate_messages.delete_many({"debate_id": {"$in": spar_ids}})
    await db.ai_debates.delete_many({"user_id": user_id})

    await db.users.delete_one({"user_id": user_id})
    await db.user_sessions.delete_many({"user_id": user_id})
    await db.friendships.delete_many({"$or": [{"user_a": user_id}, {"user_b": user_id}]})
    await db.follows.delete_many({"$or": [{"follower_id": user_id}, {"followee_id": user_id}]})
    await db.subscriptions_debater.delete_many({"$or": [{"subscriber_id": user_id}, {"debater_id": user_id}]})
    await db.topic_stances.delete_many({"user_id": user_id})
    await db.topic_stance_history.delete_many({"user_id": user_id})
    await db.match_queue.delete_many({"user_id": user_id})
    await db.party_match_queue.delete_many({"user_ids": user_id})
    await db.pending_rooms.delete_many({"user_id": user_id})
    await db.notifications.delete_many({"recipient_id": user_id})
    await db.reports.delete_many({"reporter_id": user_id})

    # Best-effort and after the DB writes, same convention as clips.py.
    delete_object(blobs)
    return {"deleted": True, "clips_removed": clips_removed, "files_removed": len(blobs)}
