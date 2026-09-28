"""Unit and integration tests for GEO AI Search Intelligence and Google Search Console services."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi.testclient import TestClient

from app.main import app
from app.core.auth import get_current_user
from app.services.geo.models import (
    NormalizedAIResponse,
    SourceReference,
    ProviderCapability,
    QueryVisibilitySummary,
)
from app.services.geo.base_provider import AIProvider
from app.services.geo.openai_provider import OpenAIProvider
from app.services.geo.gemini_provider import GeminiProvider
from app.services.geo.claude_provider import ClaudeProvider
from app.services.geo.grok_provider import GrokProvider
from app.services.geo.analyzer import GEOVisibilityAnalyzer
from app.services.gsc.models import (
    SearchPerformanceReport,
    PerformanceSummary,
    TimeseriesPoint,
    QueryPerformanceRow,
    PagePerformanceRow,
)
from app.services.gsc.service import GoogleSearchConsoleService


# ── Concrete dummy provider for testing base class logic ──────────────────────

class DummyProvider(AIProvider):
    name = "dummy"
    default_model = "dummy-v1"

    def is_configured(self) -> bool:
        return True

    def supports_web_search(self) -> bool:
        return True

    def get_capability(self) -> ProviderCapability:
        return ProviderCapability(
            provider=self.name,
            configured=True,
            web_search_supported=True,
            model=self.default_model,
            status="connected",
            message="Ready",
        )

    async def execute_query(
        self,
        query: str,
        target_brand: str,
        target_domain: str,
        competitor_domains: list[str] | None = None,
    ) -> NormalizedAIResponse:
        return NormalizedAIResponse(
            provider=self.name,
            model=self.default_model,
            query=query,
            status="completed",
        )


# ── 1. Model & Base Provider Tests ───────────────────────────────────────────

def test_source_reference_model():
    ref = SourceReference(
        url="https://example.com/blog/ai-tools",
        domain="example.com",
        title="Top AI Tools",
        order=1,
        is_own_domain=True,
        is_competitor=False,
    )
    assert ref.domain == "example.com"
    assert ref.is_own_domain is True
    assert ref.is_competitor is False


def test_normalized_ai_response_model():
    resp = NormalizedAIResponse(
        provider="test-provider",
        model="test-model",
        query="best ai tools",
        brand_mentioned=True,
        website_cited=True,
        cited_urls=["https://mysite.com/tools"],
        cited_domains=["mysite.com"],
        competitor_domains=["competitor.com"],
        sources=[
            SourceReference(
                url="https://mysite.com/tools",
                domain="mysite.com",
                is_own_domain=True,
            )
        ],
        raw_response={"text": "Hello world"},
    )
    assert resp.provider == "test-provider"
    assert resp.brand_mentioned is True
    assert resp.website_cited is True
    assert len(resp.sources) == 1


def test_base_provider_domain_extraction():
    assert AIProvider.extract_domain("https://WWW.Example.com/page?query=1") == "example.com"
    assert AIProvider.extract_domain("http://sub.domain.co.uk/") == "sub.domain.co.uk"


def test_base_provider_extract_urls():
    text = (
        "Check this guide: https://example.com/seo-guide and also "
        "refer to [Competitor Link](https://competitor.org/research)."
    )
    urls = AIProvider.extract_urls(text)
    assert "https://example.com/seo-guide" in urls
    assert "https://competitor.org/research" in urls


def test_base_provider_brand_mention_detection():
    assert AIProvider.is_brand_mentioned("Acmeteck", "We recommend Acmeteck for AI solutions.") is True
    assert AIProvider.is_brand_mentioned("Acmeteck", "We recommend Acme for AI.") is False
    assert AIProvider.is_brand_mentioned("GEOlytics", "Leading platform is geolytics.") is True


def test_base_provider_citation_evaluation():
    urls = [
        "https://mysite.com/courses",
        "https://competitor.com/best-course",
        "https://randomblog.com/overview",
    ]
    is_cited, cited_domains, comp_cited, sources = AIProvider.evaluate_citations(
        urls=urls,
        target_domain="mysite.com",
        competitor_domains=["competitor.com"],
    )
    assert is_cited is True
    assert "mysite.com" in cited_domains
    assert "competitor.com" in comp_cited
    assert len(sources) == 3
    assert sources[0].is_own_domain is True
    assert sources[1].is_competitor is True
    assert sources[2].is_own_domain is False


# ── 2. Provider Configuration & Capability Isolation ─────────────────────────

def test_openai_provider_unconfigured():
    provider = OpenAIProvider(api_key="")
    assert provider.is_configured() is False
    cap = provider.get_capability()
    assert cap.status == "not_configured"


def test_gemini_provider_unconfigured():
    provider = GeminiProvider(api_key="")
    assert provider.is_configured() is False
    cap = provider.get_capability()
    assert cap.status == "not_configured"


def test_claude_provider_web_search_unavailable():
    # Claude does not support live web citation search without custom browsing tools
    provider = ClaudeProvider(api_key="sk-ant-test-key-12345")
    assert provider.is_configured() is True
    cap = provider.get_capability()
    assert cap.status == "unavailable"
    assert cap.web_search_supported is False


def test_grok_provider_unconfigured():
    provider = GrokProvider(api_key="")
    assert provider.is_configured() is False
    cap = provider.get_capability()
    assert cap.status == "not_configured"


@pytest.mark.asyncio
async def test_openai_provider_unconfigured_execution():
    provider = OpenAIProvider(api_key="")
    result = await provider.execute_query(
        query="what is geo?",
        target_brand="GEOlytics",
        target_domain="geolytics.io",
    )
    assert result.provider == "openai"
    assert result.status == "unavailable"
    assert result.website_cited is False


@pytest.mark.asyncio
async def test_gemini_provider_unconfigured_execution():
    provider = GeminiProvider(api_key="")
    result = await provider.execute_query(
        query="what is geo?",
        target_brand="GEOlytics",
        target_domain="geolytics.io",
    )
    assert result.provider == "gemini"
    assert result.status == "unavailable"
    assert result.website_cited is False


# ── 3. Analyzer & Provider Failure Isolation ─────────────────────────────────

@pytest.mark.asyncio
async def test_analyzer_failure_isolation():
    """Verify that if one provider fails, others still succeed and the check does not crash."""
    failing_provider = MagicMock(spec=AIProvider)
    failing_provider.name = "failing-provider"
    failing_provider.default_model = "v1"
    failing_provider.is_configured.return_value = True
    failing_provider.execute_query = AsyncMock(side_effect=RuntimeError("Simulated provider outage"))

    successful_provider = MagicMock(spec=AIProvider)
    successful_provider.name = "success-provider"
    successful_provider.default_model = "v1"
    successful_provider.is_configured.return_value = True
    successful_provider.execute_query = AsyncMock(
        return_value=NormalizedAIResponse(
            provider="success-provider",
            model="v1",
            query="test query",
            status="completed",
            brand_mentioned=True,
            website_cited=True,
            cited_urls=["https://mysite.com/demo"],
            cited_domains=["mysite.com"],
            competitor_domains=[],
            sources=[],
            raw_response={},
        )
    )

    analyzer = GEOVisibilityAnalyzer(providers=[failing_provider, successful_provider])
    
    # Mock _persist_checks so database connection is not required
    analyzer._persist_checks = AsyncMock()

    summary = await analyzer.check_query(
        project_id="p-123",
        query_id="q-123",
        query_text="test query",
        target_brand="MySite",
        target_domain="mysite.com",
    )

    assert summary.query == "test query"
    assert summary.providers_tested == 1  # Only 1 completed successfully
    assert summary.providers_cited == 1
    assert summary.providers_mentioned == 1

    # Verify responses contain both
    assert len(summary.responses) == 2
    failing_res = next(r for r in summary.responses if r.provider == "failing-provider")
    success_res = next(r for r in summary.responses if r.provider == "success-provider")

    assert failing_res.status == "failed"
    assert "Simulated provider outage" in (failing_res.error or "")

    assert success_res.status == "completed"
    assert success_res.website_cited is True


# ── 4. Google Search Console Models & Logic ──────────────────────────────────

def test_gsc_performance_report_model():
    report = SearchPerformanceReport(
        site_url="https://example.com",
        days=28,
        summary=PerformanceSummary(
            total_clicks=150,
            total_impressions=3000,
            average_ctr=5.0,
            average_position=12.4,
        ),
        timeseries=[
            TimeseriesPoint(date="2026-09-27", clicks=10, impressions=200, ctr=5.0, position=12.0)
        ],
        top_queries=[
            QueryPerformanceRow(query="seo ai platform", clicks=45, impressions=500, ctr=9.0, position=3.2)
        ],
        top_pages=[
            PagePerformanceRow(page="https://example.com/", clicks=90, impressions=1500, ctr=6.0, position=4.1)
        ],
    )
    assert report.summary.total_clicks == 150
    assert len(report.timeseries) == 1
    assert report.top_queries[0].query == "seo ai platform"


def test_gsc_unconfigured_service():
    with patch("app.core.config.get_settings") as mock_settings:
        mock_settings.return_value.gsc_client_id = ""
        mock_settings.return_value.gsc_client_secret = ""
        assert GoogleSearchConsoleService.is_configured() is False


# ── 5. API Endpoints with TestClient ─────────────────────────────────────────

client = TestClient(app)


def test_geo_providers_endpoint():
    """Verify the /geo/providers endpoint returns capability states for all 5 providers."""
    app.dependency_overrides[get_current_user] = lambda: {"id": "user-123", "email": "test@user.com"}

    with patch("app.api.routes.geo._verify_project_ownership") as mock_ownership:
        mock_ownership.return_value = {"id": "proj-123", "name": "Test Project"}

        response = client.get("/api/v1/projects/proj-123/geo/providers")
        assert response.status_code == 200
        data = response.json()
        assert "providers" in data
        provider_names = [p["provider"] for p in data["providers"]]
        assert "openai" in provider_names
        assert "gemini" in provider_names
        assert "claude" in provider_names
        assert "grok" in provider_names
        assert "tavily" in provider_names

    app.dependency_overrides.clear()
