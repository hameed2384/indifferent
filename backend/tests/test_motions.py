"""Public motion pages (GET /public/motions, /public/motions/{slug})."""
from app.motions import MOTIONS


async def test_list_has_every_motion_with_slug_and_summary(client):
    r = await client.get("/api/public/motions")
    assert r.status_code == 200
    ms = r.json()["motions"]
    assert len(ms) == len(MOTIONS)
    assert all(m["slug"] and m["summary"] for m in ms)
    assert "for" not in ms[0]  # the list stays light; arguments are on the detail page


async def test_detail_by_slug_or_id(client):
    m = MOTIONS[0]
    for key in (m["slug"], m["id"]):
        r = await client.get(f"/api/public/motions/{key}")
        assert r.status_code == 200
        d = r.json()
        assert d["motion"] == m["motion"]
        assert len(d["for"]) == 3 and len(d["against"]) == 3


async def test_unknown_motion_is_404(client):
    r = await client.get("/api/public/motions/not-a-motion")
    assert r.status_code == 404


def test_slugs_and_ids_are_unique():
    assert len({m["slug"] for m in MOTIONS}) == len(MOTIONS)
    assert len({m["id"] for m in MOTIONS}) == len(MOTIONS)
