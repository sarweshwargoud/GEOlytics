"""Unit and integration tests for LangGraph intelligence pipeline, Hindsight memory, and recommendations."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi.testclient import TestClient

from app.main import app
from app.core.auth import get_current_user
from app.services.agent.models import (
    LangGraphAgentState,
    MemoryModel,
    RecommendationModel,
)
from app.services.agent.hindsight import HindsightMemoryService
from app.services.agent.approval_service import RecommendationApprovalService
from app.services.agent.graph import (
    analyze_geo_node,
    analyze_seo_node,
    generate_recommendations_node,
    recall_memory_node,
    reason_node,
    validate_recommendations_node,
    recommendation_agent_graph,
    run_intelligence_pipeline,
)

client = TestClient(app)


# ── 1. Model & Validation Tests ───────────────────────────────────────────────

def test_recommendation_model_valid():
    rec = RecommendationModel(
        project_id="p-123",
        title="Deploy FAQ Section for Hyderabad Courses",
        type="content",
        priority="high",
        action="Add an FAQ section addressing price and curriculum details.",
        reason="Query receives high impressions but has 0 cited sources observed.",
        hypothesis="Adding structured FAQ increases observable AI citations.",
        confidence=0.85,
        evidence=["Tested query 'best AI course' with 0 citations."],
        affected_pages=["https://example.com/courses"],
        affected_queries=["best AI course"],
        suggested_experiment="Deploy FAQ and monitor visibility weekly.",
        measurement_criteria=["Observed AI citations", "Organic CTR"],
        requires_approval=True,
    )
    assert rec.priority == "high"
    assert rec.requires_approval is True
    assert rec.status == "pending"


def test_memory_model_valid():
    mem = MemoryModel(
        project_id="p-123",
        memory_type="strategy",
        category="geo",
        title="Comparison Tables Impact",
        content="Comparison tables significantly improved Gemini citations.",
        confidence=0.95,
        tags=["geo", "comparison"],
    )
    assert mem.category == "geo"
    assert mem.confidence == 0.95


# ── 2. LangGraph Node Isolation Tests ─────────────────────────────────────────

@pytest.mark.asyncio
async def test_analyze_seo_node_identifies_low_ctr():
    state: LangGraphAgentState = {
        "project_id": "p-123",
        "collected_seo": {
            "gsc_performance": [
                {
                    "query": "seo automation tools",
                    "page": "https://example.com/tools",
                    "impressions": 150,
                    "clicks": 2,
                    "ctr": 1.33,
                    "position": 5.4,
                }
            ],
            "issues": [{"severity": "critical", "issue": "Missing H1", "affected_url": "https://example.com/page"}],
            "pages": [{"url": "https://example.com/page", "word_count": 120, "schema_data": []}],
        },
        "execution_log": [],
    }

    result = await analyze_seo_node(state)
    seo_analysis = result["seo_analysis"]

    assert len(seo_analysis["low_ctr_opportunities"]) == 1
    assert seo_analysis["low_ctr_opportunities"][0]["query"] == "seo automation tools"
    assert len(seo_analysis["critical_issues"]) == 1
    assert "https://example.com/page" in seo_analysis["missing_schema_pages"]


@pytest.mark.asyncio
async def test_analyze_geo_node_identifies_missing_citations():
    state: LangGraphAgentState = {
        "project_id": "p-123",
        "collected_geo": {
            "tracked_queries": [{"id": "q-1", "query": "best seo software"}],
            "latest_checks": [
                {
                    "query_id": "q-1",
                    "provider": "openai",
                    "brand_mentioned": True,
                    "website_cited": False,
                    "competitor_domains": ["rival.com"],
                }
            ],
        },
        "execution_log": [],
    }

    result = await analyze_geo_node(state)
    geo_analysis = result["geo_analysis"]

    assert len(geo_analysis["queries_missing_citations"]) == 1
    assert geo_analysis["queries_missing_citations"][0]["query"] == "best seo software"
    assert "rival.com" in geo_analysis["frequently_cited_competitor_domains"]


@pytest.mark.asyncio
async def test_validate_recommendations_node_rules():
    """Validates that proposals without evidence, with guarantee claims, or automatic modifications are filtered."""
    raw_recs = [
        # Valid proposal
        {
            "title": "Add Comparison Section",
            "type": "content",
            "priority": "high",
            "action": "Add comparison table.",
            "reason": "Competitors cited more frequently.",
            "hypothesis": "Structured comparison improves citations.",
            "evidence": ["0 citations observed across OpenAI and Gemini."],
            "affected_pages": ["https://example.com"],
            "suggested_experiment": "Monitor for 28 days.",
            "measurement_criteria": ["AI citations"],
            "requires_approval": True,
        },
        # Invalid proposal 1: Missing evidence
        {
            "title": "Random Keyword Edit",
            "type": "content",
            "priority": "low",
            "action": "Change random words.",
            "reason": "Might be good.",
            "hypothesis": "Could help.",
            "evidence": [],  # Empty evidence!
            "requires_approval": True,
        },
        # Invalid proposal 2: Guaranteed ranking claim
        {
            "title": "Guaranteed #1 Rank Strategy",
            "type": "content",
            "priority": "critical",
            "action": "Guaranteed rank #1 in 7 days.",
            "reason": "Guaranteed #1 ranking.",
            "hypothesis": "Rank 1 is guaranteed.",
            "evidence": ["Observed rank."],
            "requires_approval": True,
        },
    ]

    state: LangGraphAgentState = {
        "project_id": "p-123",
        "raw_recommendations": raw_recs,
        "execution_log": [],
    }

    with patch("app.services.agent.graph.get_supabase_admin") as mock_admin:
        mock_table = MagicMock()
        mock_table.select.return_value.eq.return_value.in_.return_value.execute.return_value.data = []
        mock_admin.return_value.table.return_value = mock_table

        res = await validate_recommendations_node(state)
        validated = res["validated_recommendations"]

        assert len(validated) == 1
        assert validated[0]["title"] == "Add Comparison Section"
        assert validated[0]["requires_approval"] is True


# ── 3. Hindsight Memory Service Tests ────────────────────────────────────────

@pytest.mark.asyncio
async def test_hindsight_unconfigured_uses_database_fallback():
    service = HindsightMemoryService(api_key="")
    assert service.is_configured() is False

    with patch("app.services.agent.hindsight.get_supabase_admin") as mock_admin:
        mock_table = MagicMock()
        mock_table.select.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value.data = [
            {
                "id": "mem-1",
                "project_id": "p-123",
                "memory_type": "strategy",
                "category": "geo",
                "title": "FAQ Schema Citations",
                "content": "FAQ schema improved citations in Gemini.",
                "source": "agent_reflection",
                "confidence": 0.95,
                "tags": ["faq", "geo"],
                "metadata": {},
                "created_at": "2026-09-28T00:00:00Z",
            }
        ]
        mock_admin.return_value.table.return_value = mock_table

        memories = await service.recall(project_id="p-123", query_context="FAQ schema citations", limit=5)
        assert len(memories) == 1
        assert memories[0].title == "FAQ Schema Citations"


@pytest.mark.asyncio
async def test_hindsight_reflection_formatting():
    service = HindsightMemoryService(api_key="")
    sample_memories = [
        MemoryModel(
            project_id="p-123",
            memory_type="strategy",
            category="seo",
            title="Schema Strategy",
            content="Added FAQ schema to pricing.",
        ),
        MemoryModel(
            project_id="p-123",
            memory_type="lesson_learned",
            category="seo",
            title="Keyword Density",
            content="Avoid stuffing keywords.",
        ),
    ]
    service.recall = AsyncMock(return_value=sample_memories)

    reflection = await service.reflect(project_id="p-123", topic="seo strategies")
    assert "✓ [SEO] Schema Strategy" in reflection
    assert "⚠ [SEO] Keyword Density" in reflection


# ── 4. Approval Service Tests ────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_recommendation_approval_workflow():
    with patch("app.services.agent.approval_service.get_supabase_admin") as mock_admin, \
         patch("app.services.agent.approval_service.HindsightMemoryService.retain", new_callable=AsyncMock) as mock_retain:
        
        mock_table = MagicMock()
        # Mock get_recommendation select
        mock_table.select.return_value.eq.return_value.eq.return_value.execute.return_value.data = [
            {
                "id": "rec-123",
                "project_id": "p-123",
                "title": "Add Comparison Section",
                "action": "Add comparison table",
                "suggested_experiment": "Track for 28 days",
                "measurement_criteria": ["AI citations"],
                "confidence": 0.9,
                "type": "content",
                "projects": {"user_id": "u-123"},
            }
        ]
        # Mock update
        mock_table.update.return_value.eq.return_value.execute.return_value.data = [
            {"id": "rec-123", "status": "approved", "requires_approval": False}
        ]
        mock_admin.return_value.table.return_value = mock_table

        approved = await RecommendationApprovalService.approve("rec-123", "u-123")
        assert approved["status"] == "approved"
        # Verify feedback memory retained in Hindsight
        assert mock_retain.called
        called_memory: MemoryModel = mock_retain.call_args[1]["memory"]
        assert called_memory.memory_type == "strategy"
        assert "Approved Strategy" in called_memory.title


@pytest.mark.asyncio
async def test_recommendation_rejection_workflow():
    with patch("app.services.agent.approval_service.get_supabase_admin") as mock_admin, \
         patch("app.services.agent.approval_service.HindsightMemoryService.retain", new_callable=AsyncMock) as mock_retain:
        
        mock_table = MagicMock()
        mock_table.select.return_value.eq.return_value.eq.return_value.execute.return_value.data = [
            {
                "id": "rec-123",
                "project_id": "p-123",
                "title": "Add Comparison Section",
                "action": "Add comparison table",
                "confidence": 0.9,
                "type": "content",
                "projects": {"user_id": "u-123"},
            }
        ]
        mock_table.update.return_value.eq.return_value.execute.return_value.data = [
            {"id": "rec-123", "status": "rejected", "rejection_reason": "Not aligned with brand", "requires_approval": False}
        ]
        mock_admin.return_value.table.return_value = mock_table

        rejected = await RecommendationApprovalService.reject("rec-123", "Not aligned with brand", "u-123")
        assert rejected["status"] == "rejected"
        assert rejected["rejection_reason"] == "Not aligned with brand"
        assert mock_retain.called
        called_memory: MemoryModel = mock_retain.call_args[1]["memory"]
        assert called_memory.memory_type == "preference"
        assert "Rejected Recommendation" in called_memory.title


# ── 5. API Endpoint Tests ────────────────────────────────────────────────────

def test_recommendations_list_endpoint():
    app.dependency_overrides[get_current_user] = lambda: {"id": "u-123", "email": "test@user.com"}

    with patch("app.api.routes.recommendations._verify_project_ownership") as mock_verify, \
         patch("app.api.routes.recommendations.get_supabase_admin") as mock_admin:
        mock_verify.return_value = {"id": "p-123", "name": "Test Project"}
        
        mock_table = MagicMock()
        mock_table.select.return_value.eq.return_value.order.return_value.execute.return_value.data = [
            {
                "id": "rec-1",
                "project_id": "p-123",
                "title": "Optimize Title Tag",
                "type": "metadata",
                "priority": "high",
                "action": "Rewrite title",
                "reason": "Low CTR",
                "hypothesis": "Increases clicks",
                "confidence": 0.85,
                "status": "pending",
                "evidence": ["CTR is 1.1%"],
                "affected_pages": ["https://example.com"],
                "affected_queries": ["seo tools"],
                "geo_observations": [],
                "competitor_observations": [],
                "historical_memory": [],
                "suggested_experiment": "Monitor for 21 days",
                "measurement_criteria": ["CTR"],
                "requires_approval": True,
                "rejection_reason": None,
                "created_at": "2026-09-28T00:00:00Z",
                "updated_at": "2026-09-28T00:00:00Z",
            }
        ]
        mock_admin.return_value.table.return_value = mock_table

        response = client.get("/api/v1/projects/p-123/recommendations")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["title"] == "Optimize Title Tag"

    app.dependency_overrides.clear()


def test_agent_memory_endpoint():
    app.dependency_overrides[get_current_user] = lambda: {"id": "u-123", "email": "test@user.com"}

    with patch("app.api.routes.agent._verify_project_ownership") as mock_verify, \
         patch("app.api.routes.agent.get_supabase_admin") as mock_admin, \
         patch("app.services.agent.hindsight.HindsightMemoryService.seed_baseline_memories_if_empty", new_callable=AsyncMock):
        mock_verify.return_value = {"id": "p-123", "name": "Test Project"}

        mock_table = MagicMock()
        mock_table.select.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value.data = [
            {
                "id": "mem-1",
                "project_id": "p-123",
                "memory_type": "strategy",
                "category": "geo",
                "title": "Comparison Tables",
                "content": "Helped improve citations.",
                "source": "agent_reflection",
                "confidence": 0.95,
                "tags": ["geo"],
                "metadata": {},
                "created_at": "2026-09-28T00:00:00Z",
            }
        ]
        mock_admin.return_value.table.return_value = mock_table

        response = client.get("/api/v1/projects/p-123/memory")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["title"] == "Comparison Tables"

    app.dependency_overrides.clear()
