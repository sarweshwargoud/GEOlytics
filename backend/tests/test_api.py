"""Tests for health endpoint and project authorization."""

import pytest
from fastapi.testclient import TestClient
from app.main import app


client = TestClient(app)


# ─── Health ──────────────────────────────────────────────

def test_health_returns_200():
    """GET /api/v1/health should return 200 with service info."""
    r = client.get("/api/v1/health")
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "healthy"
    assert "service" in data
    assert "version" in data


# ─── Auth enforcement ────────────────────────────────────

def test_projects_list_requires_auth():
    """GET /api/v1/projects without a token must return 401."""
    r = client.get("/api/v1/projects")
    assert r.status_code == 401


def test_projects_create_requires_auth():
    """POST /api/v1/projects without a token must return 401."""
    r = client.post("/api/v1/projects", json={"name": "test", "website_url": "example.com"})
    assert r.status_code == 401


def test_projects_get_requires_auth():
    """GET /api/v1/projects/<id> without a token must return 401."""
    r = client.get("/api/v1/projects/00000000-0000-0000-0000-000000000000")
    assert r.status_code == 401


def test_projects_delete_requires_auth():
    """DELETE /api/v1/projects/<id> without a token must return 401."""
    r = client.delete("/api/v1/projects/00000000-0000-0000-0000-000000000000")
    assert r.status_code == 401


def test_projects_update_requires_auth():
    """PATCH /api/v1/projects/<id> without a token must return 401."""
    r = client.patch(
        "/api/v1/projects/00000000-0000-0000-0000-000000000000",
        json={"name": "updated"},
    )
    assert r.status_code == 401


# ─── Validation ──────────────────────────────────────────

def test_health_response_shape():
    """Health response should match HealthOut schema."""
    r = client.get("/api/v1/health")
    data = r.json()
    assert set(data.keys()) == {"status", "service", "version"}


def test_invalid_bearer_token():
    """A garbage token should return 401."""
    r = client.get(
        "/api/v1/projects",
        headers={"Authorization": "Bearer invalid-token-here"},
    )
    assert r.status_code == 401
