"""DB_SETUP_ON_STARTUP decides whether server startup creates indexes — off on
Vercel (every cold start pays for it), on locally."""
import importlib

import pytest

import app.config


@pytest.fixture
def reload_config(monkeypatch):
    def _reload(**env):
        for key in ("VERCEL", "DB_SETUP_ON_STARTUP"):
            monkeypatch.delenv(key, raising=False)
        for key, value in env.items():
            monkeypatch.setenv(key, value)
        return importlib.reload(app.config).DB_SETUP_ON_STARTUP

    yield _reload
    monkeypatch.undo()
    importlib.reload(app.config)


def test_runs_locally_by_default(reload_config):
    assert reload_config() is True


def test_skipped_on_vercel(reload_config):
    assert reload_config(VERCEL="1") is False


def test_explicit_override_wins(reload_config):
    assert reload_config(VERCEL="1", DB_SETUP_ON_STARTUP="true") is True
    assert reload_config(DB_SETUP_ON_STARTUP="false") is False


async def test_startup_skips_indexes_when_disabled(monkeypatch):
    import server

    calls = []

    async def fake_create_indexes():
        calls.append(1)

    monkeypatch.setattr(server, "create_indexes", fake_create_indexes)
    monkeypatch.setattr(server, "DB_SETUP_ON_STARTUP", False)
    await server.startup()
    assert calls == []

    monkeypatch.setattr(server, "DB_SETUP_ON_STARTUP", True)
    await server.startup()
    assert calls == [1]
