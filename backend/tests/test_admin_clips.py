"""Admin removal of a claim and its reply subtree (DELETE /admin/clips/{id})."""
import pytest

import app.routers.admin as admin_router
from app.db import db
from conftest import ADMIN_EMAIL


@pytest.fixture
def deleted_blobs(monkeypatch):
    calls = []
    monkeypatch.setattr(admin_router, "delete_object", lambda urls: calls.append(list(urls)))
    return calls


async def _clip(clip_id, *, uploader="user_x", parent=None, root=None, **extra):
    doc = {
        "clip_id": clip_id, "uploader_id": uploader,
        "parent_clip_id": parent, "root_clip_id": root or clip_id,
        "category": "Politics", "caption": clip_id, "reply_count": 0,
        "video_url": f"https://blob.test/{clip_id}.webm",
        "created_at": "2026-01-01T00:00:00+00:00", **extra,
    }
    await db.clips.insert_one(doc)
    if parent:
        await db.clips.update_one({"clip_id": parent}, {"$inc": {"reply_count": 1}})


async def _tree():
    """root -> a -> a1, root -> b ; plus an unrelated claim."""
    await _clip("root")
    await _clip("a", parent="root", root="root")
    await _clip("a1", parent="a", root="root")
    await _clip("b", parent="root", root="root")
    await _clip("other")
    await db.clip_reactions.insert_many([
        {"clip_id": "a1", "user_id": "u1", "kind": "like"},
        {"clip_id": "other", "user_id": "u1", "kind": "like"},
    ])


async def test_requires_admin(client, make_user, deleted_blobs):
    await _tree()
    _, headers = await make_user()
    r = await client.delete("/api/admin/clips/root", headers=headers)
    assert r.status_code == 403
    assert await db.clips.count_documents({}) == 5


async def test_requires_xhr_header(client, make_user, deleted_blobs):
    await _tree()
    _, headers = await make_user(email=ADMIN_EMAIL)
    r = await client.delete("/api/admin/clips/root", headers={**headers, "X-Requested-With": ""})
    assert r.status_code == 403


async def test_unknown_clip_is_404(client, make_user, deleted_blobs):
    _, headers = await make_user(email=ADMIN_EMAIL)
    r = await client.delete("/api/admin/clips/nope", headers=headers)
    assert r.status_code == 404


async def test_removes_root_and_whole_thread(client, make_user, deleted_blobs):
    await _tree()
    _, headers = await make_user(email=ADMIN_EMAIL)
    r = await client.delete("/api/admin/clips/root", headers=headers)
    assert r.status_code == 200
    assert sorted(r.json()["clip_ids"]) == ["a", "a1", "b", "root"]

    remaining = [c["clip_id"] async for c in db.clips.find({}, {"clip_id": 1})]
    assert remaining == ["other"]
    assert [x["clip_id"] async for x in db.clip_reactions.find()] == ["other"]
    assert sorted(deleted_blobs[0]) == sorted(f"https://blob.test/{c}.webm" for c in ["root", "a", "a1", "b"])


async def test_removing_a_reply_fixes_parent_count(client, make_user, deleted_blobs):
    await _tree()
    _, headers = await make_user(email=ADMIN_EMAIL)
    r = await client.delete("/api/admin/clips/a", headers=headers)
    assert sorted(r.json()["clip_ids"]) == ["a", "a1"]
    root = await db.clips.find_one({"clip_id": "root"})
    assert root["reply_count"] == 1


async def test_clears_tombstoned_clip(client, make_user, deleted_blobs):
    await _clip("t", deleted=True, caption="[deleted]", video_url=None)
    await _clip("t_reply", parent="t", root="t")
    _, headers = await make_user(email=ADMIN_EMAIL)
    r = await client.delete("/api/admin/clips/t", headers=headers)
    assert r.json()["removed"] == 2
    assert await db.clips.count_documents({}) == 0
    assert deleted_blobs[0] == ["https://blob.test/t_reply.webm"]
