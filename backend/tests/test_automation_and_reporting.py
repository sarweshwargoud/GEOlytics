"""Unit and integration tests for Phase 6: Automation, Reporting, Notifications, and Production Intelligence."""

from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch
import pytest
from fastapi.testclient import TestClient

from app.core.auth import get_current_user
from app.main import app
from app.services.automation.models import (
    AutomationJobSetting,
    AutomationJobSettingUpdate,
    AutomationRunLog,
    GenerateReportRequest,
    JobFrequency,
    JobStatus,
    JobType,
    NotificationCategory,
    NotificationOut,
    NotificationPreferencesModel,
    ReportOut,
)
from app.services.automation.scheduler import AutomationScheduler
from app.services.automation.service import AutomationService
from app.services.automation.jobs import (
    job_sync_search_console,
    job_run_geo_visibility_checks,
    job_run_seo_audit,
    job_research_competitors,
    job_measure_active_experiments,
    job_generate_project_report,
)

client = TestClient(app)


# ── 1. Automation Models & Next Run Calculation ───────────────────────────────

def test_automation_settings_model_defaults():
    setting = AutomationJobSetting(
        project_id="proj-101",
        job_type="seo_sync",
        enabled=True,
        frequency="daily",
    )
    assert setting.job_type == "seo_sync"
    assert setting.frequency == "daily"
    assert setting.enabled is True
    assert setting.next_run_at is None

    # Test computing and assigning next_run_at
    next_dt = AutomationService.compute_next_run("daily")
    setting.next_run_at = next_dt.isoformat()
    assert setting.next_run_at is not None


def test_next_run_calculation():
    now = datetime(2026, 9, 28, 12, 0, 0, tzinfo=timezone.utc)
    daily_next = AutomationService.compute_next_run("daily", now)
    assert daily_next == now + timedelta(days=1)

    weekly_next = AutomationService.compute_next_run("weekly", now)
    assert weekly_next == now + timedelta(days=7)

    hourly_next = AutomationService.compute_next_run("hourly", now)
    assert hourly_next == now + timedelta(hours=1)


# ── 2. Job Execution & Failure Isolation ──────────────────────────────────────

@pytest.mark.asyncio
async def test_job_sync_search_console_unconfigured():
    with patch("app.services.automation.jobs.get_supabase_admin") as mock_admin, \
         patch("app.services.automation.jobs.GoogleSearchConsoleService.is_configured", return_value=False):
        mock_admin.return_value.table.return_value.select.return_value.eq.return_value.execute.return_value.data = []
        result = await job_sync_search_console("proj-101", "user-101")
        assert result["status"] == "skipped"
        assert "not connected" in result["message"]


@pytest.mark.asyncio
async def test_job_geo_visibility_partial_failure():
    """If one provider fails, the overall job still completes with partial_success."""
    with patch("app.services.automation.jobs.get_supabase_admin") as mock_admin, \
         patch("app.services.automation.jobs.GEOVisibilityAnalyzer") as mock_analyzer_cls:
        
        def table_side_effect(name):
            mock = MagicMock()
            if name == "projects":
                mock.select.return_value.eq.return_value.execute.return_value.data = [
                    {"website_url": "https://example.com", "name": "BrandX"}
                ]
            elif name == "ai_search_queries":
                mock.select.return_value.eq.return_value.eq.return_value.execute.return_value.data = [
                    {"id": "q-1", "query": "best seo tool"}
                ]
            return mock

        mock_admin.return_value.table.side_effect = table_side_effect
        
        mock_analyzer = MagicMock()
        cap_openai = MagicMock()
        cap_openai.provider = "openai"
        cap_openai.configured = True
        cap_grok = MagicMock()
        cap_grok.provider = "grok"
        cap_grok.configured = True
        mock_analyzer.get_capabilities.return_value = [cap_openai, cap_grok]

        # OpenAI succeeds, Grok raises an exception
        async def side_effect(project_id, query_id, query_text, target_domain, target_brand, provider_name):
            if provider_name == "openai":
                return {"website_cited": True, "brand_mentioned": True}
            raise RuntimeError("Grok API connection timed out")

        mock_analyzer.check_visibility = AsyncMock(side_effect=side_effect)
        mock_analyzer_cls.return_value = mock_analyzer

        result = await job_run_geo_visibility_checks("proj-101", "user-101")
        assert result["status"] == "partial_success"
        assert len(result["provider_errors"]) > 0
        assert "grok" in result["provider_errors"][0]
        assert result["citations_observed"] == 1


@pytest.mark.asyncio
async def test_job_run_seo_audit_freshness_skip():
    """Crawler should skip execution if a recent fresh crawl was completed within 24h."""
    with patch("app.services.automation.jobs.get_supabase_admin") as mock_admin:
        # Mock project info
        mock_admin.return_value.table.return_value.select.return_value.eq.return_value.execute.return_value.data = [
            {"website_url": "https://example.com"}
        ]

        recent_completed = (datetime.now(timezone.utc) - timedelta(hours=2)).isoformat()
        crawl_mock = MagicMock()
        crawl_mock.execute.return_value.data = [
            {"id": "crawl-prev", "completed_at": recent_completed, "status": "completed", "seo_health_score": 88}
        ]
        mock_admin.return_value.table.return_value.select.return_value.eq.return_value.order.return_value.limit.return_value = crawl_mock

        result = await job_run_seo_audit("proj-101", "user-101", force=False)
        assert result["status"] == "skipped"
        assert "fresh" in result["message"]
        assert result["hours_since_last_audit"] <= 2.5


# ── 3. Report Generation & Evidence-Based Insights ────────────────────────────

@pytest.mark.asyncio
async def test_job_generate_project_report_structure():
    with patch("app.services.automation.jobs.get_supabase_admin") as mock_admin, \
         patch("app.services.automation.jobs.HindsightMemoryService.recall", new_callable=AsyncMock) as mock_recall:
        
        from app.services.agent.models import MemoryModel
        mock_recall.return_value = [
            MemoryModel(
                title="FAQ Structure Lesson",
                content="FAQ sections increased observed citations by 40%.",
                project_id="proj-101",
                category="geo",
                memory_type="strategy",
            )
        ]

        def table_side_effect(name):
            mock = MagicMock()
            if name == "projects":
                mock.select.return_value.eq.return_value.execute.return_value.data = [
                    {"id": "proj-101", "name": "Acme SaaS", "website_url": "https://acme.io"}
                ]
            else:
                mock.select.return_value.eq.return_value.execute.return_value.data = []
                mock.select.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value.data = []
                mock.select.return_value.eq.return_value.gte.return_value.order.return_value.limit.return_value.execute.return_value.data = []
                mock.insert.return_value.execute.return_value.data = [{"id": "rep-new"}]
            return mock

        mock_admin.return_value.table.side_effect = table_side_effect

        report = await job_generate_project_report("proj-101", "user-101")
        assert report["status"] == "completed"
        report_data = report["report_data"]
        
        # Verify sections exist
        assert "seo_performance" in report_data
        assert "geo_visibility" in report_data
        assert "competitor_insights" in report_data
        assert "recommendations" in report_data
        assert "experiments" in report_data
        assert "hindsight_learnings" in report_data
        assert "limitations" in report_data
        
        # Verify limitations transparently note GSC latency
        assert any("Search Console metrics carry a standard" in lim or "Search Console" in lim for lim in report_data["limitations"])


# ── 4. Notifications & Preferences ────────────────────────────────────────────

@pytest.mark.asyncio
async def test_notification_dispatch_and_preference_filtering():
    with patch("app.services.automation.service.get_supabase_admin") as mock_admin:
        def table_side_effect(name):
            mock = MagicMock()
            if name == "notification_preferences":
                mock.select.return_value.eq.return_value.eq.return_value.execute.return_value.data = [
                    {
                        "user_id": "u-101",
                        "project_id": "proj-101",
                        "weekly_reports": False,
                        "high_priority_recs": True,
                    }
                ]
            elif name == "notifications":
                mock.insert.return_value.execute.return_value.data = [
                    {
                        "id": "notif-1",
                        "user_id": "u-101",
                        "project_id": "proj-101",
                        "category": "recommendation",
                        "title": "High Priority Recommendation",
                        "message": "Found schema opportunity.",
                        "is_read": False,
                        "created_at": datetime.now(timezone.utc).isoformat(),
                    }
                ]
            return mock

        mock_admin.return_value.table.side_effect = table_side_effect

        # When weekly report event triggers, it should be filtered out
        notif_report = await AutomationService.dispatch_notification(
            user_id="u-101",
            project_id="proj-101",
            category="report",
            title="Weekly Report Ready",
            message="Your report is ready.",
        )
        assert notif_report is None

        # When high priority rec event triggers, it should be inserted
        notif_rec = await AutomationService.dispatch_notification(
            user_id="u-101",
            project_id="proj-101",
            category="recommendation",
            title="High Priority Recommendation",
            message="Found schema opportunity.",
        )
        assert notif_rec is not None
        assert notif_rec["title"] == "High Priority Recommendation"


# ── 5. Project Health (No arbitrary fake AI score) ────────────────────────────

@pytest.mark.asyncio
async def test_project_health_breakdown():
    with patch.object(AutomationService, "_verify_project_ownership", return_value={"id": "proj-101", "name": "Health Test"}), \
         patch("app.services.automation.service.get_supabase_admin") as mock_admin, \
         patch("app.services.gsc.service.GoogleSearchConsoleService.is_configured", return_value=True):
        
        def table_side_effect(name):
            mock = MagicMock()
            mock.select.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value.data = []
            mock.select.return_value.eq.return_value.execute.return_value.data = []
            mock.select.return_value.eq.return_value.in_.return_value.execute.return_value.data = []
            mock.select.return_value.eq.return_value.eq.return_value.execute.return_value.data = []
            return mock

        mock_admin.return_value.table.side_effect = table_side_effect
        
        health = await AutomationService.get_project_health("proj-101", "u-101")
        assert health.seo is not None
        assert health.geo is not None
        assert health.gsc is not None
        assert health.experiments is not None
        assert health.automation is not None

        # Assert no single combined fake number is assigned
        health_dict = health.model_dump()
        assert "overall_ai_score" not in health_dict
        assert "ai_health_score" not in health_dict


# ── 6. API Routes Integration Tests ──────────────────────────────────────────

def test_automation_settings_endpoint():
    app.dependency_overrides[get_current_user] = lambda: {"id": "u-101", "email": "test@user.com"}

    with patch("app.services.automation.service.AutomationService._verify_project_ownership") as mock_verify, \
         patch("app.services.automation.service.AutomationService.get_or_create_default_settings", new_callable=AsyncMock) as mock_get_settings:
        
        mock_verify.return_value = {"id": "proj-101"}
        mock_get_settings.return_value = [
            AutomationJobSetting(
                id="s-1",
                project_id="proj-101",
                job_type="seo_sync",
                enabled=True,
                frequency="daily",
            )
        ]

        response = client.get("/api/v1/projects/proj-101/automation/settings")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["job_type"] == "seo_sync"

    app.dependency_overrides.clear()


def test_reports_list_and_detail_endpoint():
    app.dependency_overrides[get_current_user] = lambda: {"id": "u-101", "email": "test@user.com"}

    with patch("app.services.automation.service.AutomationService._verify_project_ownership") as mock_verify, \
         patch("app.api.routes.reports.get_supabase_admin") as mock_admin:
        
        mock_verify.return_value = {"id": "proj-101"}
        report_row = {
            "id": "rep-101",
            "project_id": "proj-101",
            "report_type": "weekly_intelligence",
            "period_start": "2026-09-20T00:00:00Z",
            "period_end": "2026-09-27T00:00:00Z",
            "status": "completed",
            "summary": "Weekly SEO & GEO summary",
            "data": {"seo_performance": {"clicks": 1420}},
            "created_at": "2026-09-27T10:00:00Z",
        }
        mock_table = MagicMock()
        mock_table.select.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value.data = [report_row]
        mock_admin.return_value.table.return_value = mock_table

        response = client.get("/api/v1/projects/proj-101/reports")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["id"] == "rep-101"
        assert data[0]["data"]["seo_performance"]["clicks"] == 1420

    app.dependency_overrides.clear()


def test_notifications_read_endpoint():
    app.dependency_overrides[get_current_user] = lambda: {"id": "u-101", "email": "test@user.com"}

    with patch("app.services.automation.service.AutomationService.mark_notification_read", new_callable=AsyncMock) as mock_mark:
        mock_mark.return_value = {"id": "notif-1", "is_read": True}

        response = client.post("/api/v1/notifications/notif-1/read")
        assert response.status_code == 200
        assert response.json()["status"] == "ok"

    app.dependency_overrides.clear()


def test_detailed_health_endpoint():
    """Tests that GET /api/v1/health?detailed=true exposes service configuration statuses without credentials."""
    response = client.get("/api/v1/health?detailed=true")
    assert response.status_code == 200
    data = response.json()
    assert "services" in data
    assert "database" in data
    services = data["services"]
    assert "openai" in services
    assert "gemini" in services
    assert "grok" in services
    assert "tavily" in services
    assert "hindsight" in services
    # Ensure no secret strings are leaked in any value
    for k, v in services.items():
        assert not any(secret in str(v).lower() for secret in ["sk-", "key-", "secret", "bearer", "password"])
