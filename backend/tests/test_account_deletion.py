"""Account deletion (self-service and admin) removes identity data and the
person's own media, but keeps shared content other users rely on."""
import app.accounts as accounts
from app.db import db
from conftest import ADMIN_EMAIL


async def _seed(user_id):
    await db.users.update_one({"user_id": user_id}, {"$set": {"verification_doc_url": "https://blob.test/id.png"}})
    await db.debate_recordings.insert_one({"room_id": "r1", "user_id": user_id, "seq": 0, "url": "https://blob.test/rec0.webm"})
    await db.clips.insert_many([
        {"clip_id": "leaf", "uploader_id": user_id, "parent_clip_id": None, "root_clip_id": "leaf", "reply_count": 0, "video_url": "https://blob.test/leaf.webm", "caption": "x", "category": "c"},
        {"clip_id": "parent", "uploader_id": user_id, "parent_clip_id": None, "root_clip_id": "parent", "reply_count": 1, "video_url": "https://blob.test/parent.webm", "caption": "y", "category": "c"},
        {"clip_id": "theirs", "uploader_id": "someone_else", "parent_clip_id": "parent", "root_clip_id": "parent", "reply_count": 0, "video_url": "https://blob.test/theirs.webm", "caption": "z", "category": "c"},
    ])
    await db.ai_debates.insert_one({"debate_id": "spar_1", "user_id": user_id})
    await db.ai_debate_messages.insert_one({"debate_id": "spar_1", "role": "user", "text": "hi"})
    await db.chat_messages.insert_one({"room_id": "r1", "sender_id": user_id, "text": "shared history"})


async def test_self_service_deletion(client, make_user, monkeypatch):
    deleted = []
    monkeypatch.setattr(accounts, "delete_object", lambda urls: deleted.extend(urls))
    user, headers = await make_user(onboarded=True, stances={"cats": 5})
    uid = user["user_id"]
    await _seed(uid)

    r = await client.delete("/api/users/me", headers=headers)
    assert r.status_code == 200
    assert "Max-Age=0" in r.headers.get("set-cookie", "")

    assert await db.users.find_one({"user_id": uid}) is None
    assert await db.user_sessions.count_documents({"user_id": uid}) == 0
    assert await db.topic_stances.count_documents({"user_id": uid}) == 0
    assert await db.debate_recordings.count_documents({"user_id": uid}) == 0
    assert await db.ai_debates.count_documents({}) == 0 and await db.ai_debate_messages.count_documents({}) == 0
    # Leaf claim gone; claim with someone else's reply tombstoned; their reply untouched.
    assert await db.clips.find_one({"clip_id": "leaf"}) is None
    parent = await db.clips.find_one({"clip_id": "parent"})
    assert parent["deleted"] and parent["video_url"] is None
    assert (await db.clips.find_one({"clip_id": "theirs"}))["video_url"]
    # Shared debate history kept.
    assert await db.chat_messages.count_documents({"sender_id": uid}) == 1
    assert set(deleted) == {"https://blob.test/id.png", "https://blob.test/rec0.webm",
                            "https://blob.test/leaf.webm", "https://blob.test/parent.webm"}

    assert (await client.get("/api/auth/me", headers=headers)).status_code == 401


async def test_self_deletion_requires_xhr(client, make_user):
    _, headers = await make_user()
    r = await client.delete("/api/users/me", headers={**headers, "X-Requested-With": ""})
    assert r.status_code == 403


async def test_admin_deletion_uses_same_cleanup(client, make_user, monkeypatch):
    deleted = []
    monkeypatch.setattr(accounts, "delete_object", lambda urls: deleted.extend(urls))
    target, _ = await make_user()
    await _seed(target["user_id"])
    _, admin = await make_user(email=ADMIN_EMAIL)
    r = await client.delete(f"/api/admin/users/{target['user_id']}", headers=admin)
    assert r.status_code == 200 and r.json()["deleted"] is True
    assert "https://blob.test/id.png" in deleted
