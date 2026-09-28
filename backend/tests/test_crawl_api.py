"""API security and routing tests for crawl and audit endpoints."""

import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

DUMMY_PROJECT_ID = "00000000-0000-0000-0000-000000000001"


def test_trigger_crawl_requires_auth():
    res = client.post(f"/api/v1/projects/{DUMMY_PROJECT_ID}/crawl", json={"max_pages": 10})
    assert res.status_code == 401


def test_list_crawl_runs_requires_auth():
    res = client.get(f"/api/v1/projects/{DUMMY_PROJECT_ID}/crawl-runs")
    assert res.status_code == 401


def test_get_audit_overview_requires_auth():
    res = client.get(f"/api/v1/projects/{DUMMY_PROJECT_ID}/audit")
    assert res.status_code == 401


def test_get_audit_issues_requires_auth():
    res = client.get(f"/api/v1/projects/{DUMMY_PROJECT_ID}/audit/issues")
    assert res.status_code == 401


def test_get_audit_pages_requires_auth():
    res = client.get(f"/api/v1/projects/{DUMMY_PROJECT_ID}/audit/pages")
    assert res.status_code == 401
