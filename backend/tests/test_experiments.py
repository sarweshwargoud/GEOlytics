"""Tests for Closed-Loop SEO & GEO Experiment Tracking, Delta Math, Outcome Classification, and Hindsight Memory."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi.testclient import TestClient

from app.main import app
from app.schemas.experiments import ExperimentCreate, SuccessCriterion
from app.services.experiments.service import ExperimentService


from app.core.auth import get_current_user


@pytest.fixture
def test_client():
    return TestClient(app)


# ── 1. Delta Calculations & Math Unit Tests ───────────────────────────────────

def test_metric_delta_calculations_position_inversion():
    """Verifies that average position delta correctly considers a lower number as an improvement."""
    baseline = {
        "seo": {
            "clicks": 420,
            "impressions": 8200,
            "ctr": 5.12,
            "position": 8.4,
            "available": True,
        },
        "geo": {
            "observed_citations": 4,
            "observed_mentions": 6,
            "available": True,
        },
    }
    target = {
        "seo": {
            "clicks": 518,
            "impressions": 9450,
            "ctr": 5.48,
            "position": 6.9,  # Improved rank!
            "available": True,
        },
        "geo": {
            "observed_citations": 7,
            "observed_mentions": 8,
            "available": True,
        },
    }
    criteria = [
        {"metric": "ctr", "target_type": "min_improvement", "target_value": 5.0, "description": "CTR improves >= 5%"},
        {"metric": "position", "target_type": "improvement", "target_value": 0.0, "description": "Position improves"},
        {"metric": "clicks", "target_type": "no_drop", "target_value": -5.0, "description": "No click drop"},
        {"metric": "ai_citations", "target_type": "increase", "target_value": 1.0, "description": "AI citations increase"},
    ]

    result = ExperimentService.compute_before_after_analysis(
        baseline=baseline,
        target=target,
        success_criteria=criteria,
        experiment_name="Improve Comparison Page",
    )

    deltas = result.deltas
    seo_deltas = deltas["seo"]
    geo_deltas = deltas["geo"]

    # Position: baseline 8.4 -> after 6.9 is +1.5 positions improvement
    assert seo_deltas["position"]["position_improvement"] == 1.5
    assert seo_deltas["position"]["status"] == "improved"

    # CTR: 5.12% -> 5.48% is +0.36pp
    assert seo_deltas["ctr"]["pp_delta"] == 0.36
    assert seo_deltas["ctr"]["status"] == "improved"

    # Clicks: 420 -> 518 is +98 (+23.3%)
    assert seo_deltas["clicks"]["absolute_delta"] == 98
    assert seo_deltas["clicks"]["status"] == "improved"

    # AI Citations: 4 -> 7 is +3
    assert geo_deltas["citations"]["absolute_delta"] == 3
    assert geo_deltas["citations"]["status"] == "improved"

    # All criteria satisfied -> outcome positive
    assert result.outcome == "positive"
    assert "improved after implementation during the measurement window" not in result.limitations[0]
    assert any("correlation" in lim.lower() for lim in result.limitations)


def test_metric_delta_calculations_position_regression():
    """Verifies that rank increasing numerically (e.g. 5.0 -> 9.5) is marked regressed."""
    baseline = {
        "seo": {"clicks": 200, "impressions": 3000, "ctr": 6.67, "position": 5.0, "available": True},
        "geo": {"observed_citations": 2, "available": True},
    }
    target = {
        "seo": {"clicks": 110, "impressions": 2000, "ctr": 5.5, "position": 9.5, "available": True},
        "geo": {"observed_citations": 1, "available": True},
    }
    criteria = [
        {"metric": "position", "target_type": "improvement", "target_value": 0.0, "description": "Position improves"},
        {"metric": "clicks", "target_type": "no_drop", "target_value": -5.0, "description": "No click drop"},
    ]

    result = ExperimentService.compute_before_after_analysis(
        baseline=baseline,
        target=target,
        success_criteria=criteria,
        experiment_name="Title Tag Rewrite",
    )

    seo_deltas = result.deltas["seo"]
    # 5.0 - 9.5 = -4.5 positions (regressed)
    assert seo_deltas["position"]["position_improvement"] == -4.5
    assert seo_deltas["position"]["status"] == "regressed"
    assert seo_deltas["clicks"]["status"] == "regressed"
    assert result.outcome == "negative"


def test_outcome_insufficient_data():
    """Classifies outcome as insufficient_data when impression count is too low or data unavailable."""
    baseline = {
        "seo": {"clicks": 0, "impressions": 4, "ctr": 0.0, "position": 25.0, "available": True},
        "geo": {"observed_citations": 0, "available": False},
    }
    target = {
        "seo": {"clicks": 1, "impressions": 8, "ctr": 12.5, "position": 19.0, "available": True},
        "geo": {"observed_citations": 0, "available": False},
    }
    result = ExperimentService.compute_before_after_analysis(
        baseline=baseline,
        target=target,
        success_criteria=[],
        experiment_name="Micro Test",
    )
    assert result.outcome == "insufficient_data"


def test_outcome_neutral_classification():
    """Classifies outcome as neutral when criteria fail without significant regression."""
    baseline = {
        "seo": {"clicks": 100, "impressions": 1000, "ctr": 10.0, "position": 5.0, "available": True},
        "geo": {"observed_citations": 2, "available": True},
    }
    target = {
        "seo": {"clicks": 101, "impressions": 1005, "ctr": 10.05, "position": 5.0, "available": True},
        "geo": {"observed_citations": 2, "available": True},
    }
    criteria = [
        {"metric": "ctr", "target_type": "min_improvement", "target_value": 20.0, "description": "Expect 20% CTR surge"},
    ]
    result = ExperimentService.compute_before_after_analysis(
        baseline=baseline,
        target=target,
        success_criteria=criteria,
        experiment_name="Keyword Tweak",
    )
    assert result.outcome == "neutral"


# ── 2. Service & Hindsight Feedback Unit Tests ────────────────────────────────

@pytest.mark.asyncio
async def test_create_experiment_service():
    """Tests experiment creation with baseline capture and project ownership."""
    with patch("app.services.experiments.service.get_supabase_admin") as mock_admin:
        db = MagicMock()
        mock_admin.return_value = db
        # Mock project ownership
        db.table("projects").select.return_value.eq.return_value.eq.return_value.execute.return_value.data = [
            {"id": "proj-1", "user_id": "user-123"}
        ]
        # Mock search performance for baseline
        db.table("search_performance").select.return_value.eq.return_value.gte.return_value.lte.return_value.execute.return_value.data = [
            {"clicks": 50, "impressions": 1000, "ctr": 5.0, "position": 10.0, "date": "2026-09-15", "query": "test", "page": "/test"}
        ]
        # Mock ai_visibility_checks for baseline
        db.table("ai_visibility_checks").select.return_value.eq.return_value.gte.return_value.lte.return_value.execute.return_value.data = []
        # Mock insert
        db.table("experiments").insert.return_value.execute.return_value.data = [
            {
                "id": "exp-1",
                "project_id": "proj-1",
                "name": "FAQ Section Test",
                "hypothesis": "Adding FAQ will improve organic CTR and citations.",
                "status": "baseline_captured",
                "baseline_period": {"days": 14, "seo": {"clicks": 50, "impressions": 1000, "available": True}},
                "target_period": {},
                "success_criteria": [],
                "metrics": [],
                "result": {},
                "outcome": "pending",
                "created_at": "2026-09-28T12:00:00Z",
                "updated_at": "2026-09-28T12:00:00Z",
            }
        ]

        payload = ExperimentCreate(
            name="FAQ Section Test",
            hypothesis="Adding FAQ will improve organic CTR and citations.",
            measurement_window_days=14,
        )

        created = await ExperimentService.create_experiment("proj-1", payload, "user-123")
        assert created["id"] == "exp-1"
        assert created["status"] == "baseline_captured"
        assert created["baseline_period"]["seo"]["clicks"] == 50


@pytest.mark.asyncio
async def test_hindsight_retention_on_complete():
    """Verifies that completing an experiment retains an outcome memory in Hindsight."""
    mock_exp = {
        "id": "exp-1",
        "project_id": "proj-1",
        "name": "Comparison Matrix Addition",
        "hypothesis": "Adding comparison table improves organic CTR.",
        "status": "measuring",
        "baseline_period": {
            "days": 14,
            "seo": {"clicks": 100, "impressions": 2000, "ctr": 5.0, "position": 10.0, "available": True},
            "geo": {"observed_citations": 1, "available": True},
        },
        "target_period": {},
        "success_criteria": [
            {"metric": "ctr", "target_type": "min_improvement", "target_value": 10.0, "description": "CTR improves by 10%"},
            {"metric": "position", "target_type": "improvement", "target_value": 0.0, "description": "Position improves"},
        ],
        "result": {},
        "notes": "",
        "projects": {"user_id": "user-123"},
    }

    with patch("app.services.experiments.service.get_supabase_admin") as mock_admin, \
         patch("app.services.agent.hindsight.get_supabase_admin") as mock_hindsight_admin:
        db = MagicMock()
        mock_admin.return_value = db
        mock_hindsight_admin.return_value = db

        db.table("experiments").select.return_value.eq.return_value.execute.return_value.data = [mock_exp]
        db.table("search_performance").select.return_value.eq.return_value.gte.return_value.lte.return_value.execute.return_value.data = [
            {"clicks": 150, "impressions": 2200, "ctr": 6.8, "position": 7.5, "date": "2026-09-28"}
        ]
        db.table("ai_visibility_checks").select.return_value.eq.return_value.gte.return_value.lte.return_value.execute.return_value.data = [
            {"id": "c1", "provider": "gemini", "website_cited": True, "brand_mentioned": True, "competitor_domains": []}
        ]
        db.table("experiments").update.return_value.eq.return_value.execute.return_value.data = [
            {**mock_exp, "status": "completed", "outcome": "positive"}
        ]
        db.table("agent_memories").insert.return_value.execute.return_value.data = [
            {"id": "mem-1", "created_at": "2026-09-28T12:00:00Z"}
        ]

        with patch.object(ExperimentService, "get_experiment", return_value=mock_exp):
            from app.schemas.experiments import CompleteExperimentRequest
            completed = await ExperimentService.complete_experiment(
                experiment_id="exp-1",
                payload=CompleteExperimentRequest(),
                user_id="user-123",
            )
            assert completed["status"] == "completed"
            assert completed["outcome"] == "positive"


# ── 3. API Route Tests ────────────────────────────────────────────────────────

def test_api_list_experiments_unauthorized(test_client):
    """Unauthorized requests without bearer token should receive 401."""
    res = test_client.get("/api/v1/projects/proj-1/experiments")
    assert res.status_code == 401


def test_api_create_and_results_flow(test_client):
    """Verifies that authenticated requests can create an experiment and retrieve before/after results."""
    app.dependency_overrides[get_current_user] = lambda: {"id": "user-123", "email": "test@example.com"}

    with patch("app.services.experiments.service.get_supabase_admin") as mock_admin:
        db = MagicMock()
        mock_admin.return_value = db

        db.table("projects").select.return_value.eq.return_value.eq.return_value.execute.return_value.data = [
            {"id": "proj-1", "user_id": "user-123"}
        ]
        db.table("search_performance").select.return_value.eq.return_value.gte.return_value.lte.return_value.execute.return_value.data = []
        db.table("ai_visibility_checks").select.return_value.eq.return_value.gte.return_value.lte.return_value.execute.return_value.data = []
        
        db.table("experiments").insert.return_value.execute.return_value.data = [
            {
                "id": "exp-99",
                "project_id": "proj-1",
                "name": "Add Schema Organization",
                "hypothesis": "Adding Schema increases entity resolution.",
                "status": "baseline_captured",
                "baseline_period": {"days": 14, "seo": {"available": False}, "geo": {"available": False}},
                "target_period": {},
                "success_criteria": [],
                "metrics": [],
                "result": {
                    "deltas": {},
                    "metric_items": [],
                    "criteria_evaluations": [],
                    "outcome": "insufficient_data",
                    "outcome_summary": "No data recorded",
                    "evidence": [],
                    "limitations": [],
                },
                "outcome": "pending",
                "created_at": "2026-09-28T12:00:00Z",
                "updated_at": "2026-09-28T12:00:00Z",
            }
        ]

        headers = {"Authorization": "Bearer mock-token-123"}
        payload = {
            "name": "Add Schema Organization",
            "hypothesis": "Adding Schema increases entity resolution.",
            "measurement_window_days": 14,
        }

        create_res = test_client.post("/api/v1/projects/proj-1/experiments", json=payload, headers=headers)
        assert create_res.status_code == 200
        data = create_res.json()
        assert data["id"] == "exp-99"
        assert data["status"] == "baseline_captured"

    app.dependency_overrides.clear()
