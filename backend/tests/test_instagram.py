"""Admin Instagram publishing, against a fake Graph API (nothing real is posted)."""
import pytest

import app.routers.instagram as ig
from app.db import db
from app.instagram_posts import POSTS
from conftest import ADMIN_EMAIL

SINGLE = next(p for p in POSTS if len(p["images"]) == 1 and not p.get("video"))
CAROUSEL = next(p for p in POSTS if len(p["images"]) > 1 and not p.get("video"))


class FakeGraph:
    def __init__(self):
        self.calls = []
        self.status = "FINISHED"
        self.fail_on = None
        self._n = 0

    async def __call__(self, method, path, **params):
        self.calls.append((method, path, params))
        if self.fail_on and self.fail_on in path:
            raise ig.GraphError("The image could not be downloaded")
        if method == "GET" and path == "ig_user_1":
            return {"username": "indifferent.app"}
        if method == "GET" and params.get("fields") == "status_code":
            return {"status_code": self.status}
        if method == "GET" and params.get("fields") == "permalink":
            return {"permalink": "https://www.instagram.com/p/abc123/"}
        if path.endswith("/media_publish"):
            return {"id": "media_999"}
        self._n += 1
        return {"id": f"container_{self._n}"}


@pytest.fixture
def fake(monkeypatch):
    f = FakeGraph()
    monkeypatch.setattr(ig, "graph", f)
    monkeypatch.setattr(ig, "INSTAGRAM_ACCESS_TOKEN", "test-token")
    monkeypatch.setattr(ig, "INSTAGRAM_USER_ID", "ig_user_1")
    return f


@pytest.fixture
async def admin_headers(make_user):
    _, headers = await make_user(email=ADMIN_EMAIL)
    return headers


async def test_requires_admin(client, make_user, fake):
    _, headers = await make_user()
    assert (await client.get("/api/admin/instagram", headers=headers)).status_code == 403
    r = await client.post(f"/api/admin/instagram/posts/{SINGLE['id']}/prepare", json={"caption": "x"}, headers=headers)
    assert r.status_code == 403
    assert fake.calls == []


async def test_overview_lists_posts_and_account(client, admin_headers, fake):
    r = await client.get("/api/admin/instagram", headers=admin_headers)
    assert r.status_code == 200
    d = r.json()
    assert d["configured"] is True
    assert d["account"] == {"username": "indifferent.app"}
    assert len(d["posts"]) == len(POSTS)
    first = d["posts"][0]
    assert first["status"] == "draft"
    assert first["images"][0].startswith("https://www.indifferentapp.com/social/")
    assert "#debate" in first["caption"]


async def test_not_configured(client, admin_headers, monkeypatch):
    monkeypatch.setattr(ig, "INSTAGRAM_ACCESS_TOKEN", "")
    d = (await client.get("/api/admin/instagram", headers=admin_headers)).json()
    assert d["configured"] is False and d["account"] is None
    r = await client.post(f"/api/admin/instagram/posts/{SINGLE['id']}/prepare", json={"caption": "x"}, headers=admin_headers)
    assert r.status_code == 400


async def test_single_image_publish_flow(client, admin_headers, fake):
    pid = SINGLE["id"]
    r = await client.post(f"/api/admin/instagram/posts/{pid}/prepare", json={"caption": "Hello"}, headers=admin_headers)
    assert r.status_code == 200, r.text
    create = [c for c in fake.calls if c[0] == "POST"]
    assert len(create) == 1 and create[0][2]["caption"] == "Hello"
    assert create[0][2]["image_url"].endswith("/social/" + SINGLE["images"][0])

    fake.status = "IN_PROGRESS"
    r = await client.post(f"/api/admin/instagram/posts/{pid}/publish", headers=admin_headers)
    assert r.json()["status"] == "processing"

    fake.status = "FINISHED"
    r = await client.post(f"/api/admin/instagram/posts/{pid}/publish", headers=admin_headers)
    assert r.status_code == 200
    assert r.json()["status"] == "published"
    assert r.json()["permalink"] == "https://www.instagram.com/p/abc123/"

    # Can't publish the same post twice
    r = await client.post(f"/api/admin/instagram/posts/{pid}/prepare", json={"caption": "Again"}, headers=admin_headers)
    assert r.status_code == 409
    doc = await db.instagram_posts.find_one({"post_id": pid})
    assert doc["media_id"] == "media_999"


async def test_carousel_creates_children_then_parent(client, admin_headers, fake):
    r = await client.post(f"/api/admin/instagram/posts/{CAROUSEL['id']}/prepare", json={"caption": "Swipe"}, headers=admin_headers)
    assert r.status_code == 200, r.text
    posts = [c[2] for c in fake.calls if c[0] == "POST"]
    children = [p for p in posts if p.get("is_carousel_item") == "true"]
    parent = [p for p in posts if p.get("media_type") == "CAROUSEL"]
    assert len(children) == len(CAROUSEL["images"])
    assert len(parent) == 1 and parent[0]["caption"] == "Swipe"
    assert len(parent[0]["children"].split(",")) == len(CAROUSEL["images"])


async def test_failure_is_recorded_and_can_retry(client, admin_headers, fake):
    pid = SINGLE["id"]
    fake.fail_on = "/media"
    r = await client.post(f"/api/admin/instagram/posts/{pid}/prepare", json={"caption": "x"}, headers=admin_headers)
    assert r.status_code == 502
    assert "could not be downloaded" in r.json()["detail"]
    assert (await db.instagram_posts.find_one({"post_id": pid}))["status"] == "failed"

    fake.fail_on = None
    r = await client.post(f"/api/admin/instagram/posts/{pid}/prepare", json={"caption": "x"}, headers=admin_headers)
    assert r.status_code == 200


async def test_publish_before_prepare_is_rejected(client, admin_headers, fake):
    r = await client.post(f"/api/admin/instagram/posts/{SINGLE['id']}/publish", headers=admin_headers)
    assert r.status_code == 400


async def test_requires_xhr(client, admin_headers, fake):
    r = await client.post(f"/api/admin/instagram/posts/{SINGLE['id']}/prepare", json={"caption": "x"},
                          headers={**admin_headers, "X-Requested-With": ""})
    assert r.status_code == 403


def test_token_kind_picks_the_right_api_host():
    assert ig._graph_host("IGAAexample") == "https://graph.instagram.com"
    assert ig._graph_host("EAAexample") == "https://graph.facebook.com"


async def test_ig_token_is_renewed_and_used(monkeypatch):
    monkeypatch.setattr(ig, "INSTAGRAM_ACCESS_TOKEN", "IGoriginal")
    monkeypatch.setattr(ig, "INSTAGRAM_USER_ID", "ig_user_1")
    calls = []
    def fake_refresh(token):
        calls.append(token)
        return {"access_token": "IGrenewed", "expires_in": 5184000}
    monkeypatch.setattr(ig, "_refresh_sync", fake_refresh)

    doc = await ig.maybe_refresh_token()
    assert calls == ["IGoriginal"] and doc["expires_at"]
    assert (await ig.current_token())[0] == "IGrenewed"

    # Not renewed again within a week
    await ig.maybe_refresh_token()
    assert calls == ["IGoriginal"]

    # A new token pasted into the environment takes over from the stored one
    monkeypatch.setattr(ig, "INSTAGRAM_ACCESS_TOKEN", "IGpastedNew")
    assert (await ig.current_token())[0] == "IGpastedNew"


async def test_failed_renewal_keeps_the_env_token_and_waits(monkeypatch):
    monkeypatch.setattr(ig, "INSTAGRAM_ACCESS_TOKEN", "IGtooNew")
    monkeypatch.setattr(ig, "INSTAGRAM_USER_ID", "ig_user_1")
    calls = []
    def failing(token):
        calls.append(token)
        raise ig.GraphError("Token must be at least 24 hours old")
    monkeypatch.setattr(ig, "_refresh_sync", failing)

    await ig.maybe_refresh_token()
    await ig.maybe_refresh_token()  # within the retry window: no second call
    assert calls == ["IGtooNew"]
    assert (await ig.current_token())[0] == "IGtooNew"


async def test_system_user_tokens_are_not_renewed(monkeypatch):
    monkeypatch.setattr(ig, "INSTAGRAM_ACCESS_TOKEN", "EAAsystem")
    monkeypatch.setattr(ig, "INSTAGRAM_USER_ID", "ig_user_1")
    monkeypatch.setattr(ig, "_refresh_sync", lambda t: (_ for _ in ()).throw(AssertionError("should not refresh")))
    assert await ig.maybe_refresh_token() is None


async def test_reel_publishes_video_with_cover(client, admin_headers, fake, monkeypatch):
    reel = {"id": "reel-test", "title": "Reel", "images": ["cover.jpg"], "video": "reel.mp4", "caption": "Watch"}
    monkeypatch.setitem(ig.POSTS_BY_ID, "reel-test", reel)
    r = await client.post("/api/admin/instagram/posts/reel-test/prepare", json={"caption": "Watch this"}, headers=admin_headers)
    assert r.status_code == 200, r.text
    (create,) = [c[2] for c in fake.calls if c[0] == "POST"]
    assert create["media_type"] == "REELS"
    assert create["video_url"].endswith("/social/reel.mp4")
    assert create["cover_url"].endswith("/social/cover.jpg")
    assert create["caption"] == "Watch this"
