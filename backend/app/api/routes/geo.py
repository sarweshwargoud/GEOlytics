"""API routes for GEO (AI Search) Intelligence, tracked queries, and visibility checks."""

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status

from app.core.auth import get_current_user
from app.core.database import get_supabase_admin
from app.schemas.geo import (
    CompetitorResearchRequest,
    ProviderStatusResponse,
    TrackedQueryCreate,
    TrackedQueryOut,
    VisibilityCheckTrigger,
)
from app.services.crawler.url_utils import get_base_domain
from app.services.geo.analyzer import GEOVisibilityAnalyzer
from app.services.geo.models import ProviderCapability, QueryVisibilitySummary
from app.services.geo.tavily_provider import TavilyResearchService

router = APIRouter(prefix="/projects/{project_id}/geo", tags=["GEO Intelligence"])


def _verify_project_ownership(project_id: str, user_id: str) -> dict:
    supabase = get_supabase_admin()
    res = (
        supabase.table("projects")
        .select("*")
        .eq("id", project_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not res.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found or unauthorized",
        )
    return res.data[0]


@router.get("/providers", response_model=ProviderStatusResponse)
async def get_provider_status(
    project_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Returns the configuration and readiness status of each supported AI search and research provider."""
    _verify_project_ownership(project_id, current_user["id"])
    analyzer = GEOVisibilityAnalyzer()
    caps = analyzer.get_capabilities()
    tavily = TavilyResearchService()
    caps.append(
        ProviderCapability(
            provider="tavily",
            configured=tavily.is_configured(),
            web_search_supported=True,
            model="tavily-search-api",
            status="connected" if tavily.is_configured() else "not_configured",
            message="Ready for public web & competitor baseline research." if tavily.is_configured() else "TAVILY_API_KEY environment variable is not set.",
        )
    )
    return ProviderStatusResponse(providers=caps)


@router.get("/queries", response_model=List[TrackedQueryOut])
async def list_tracked_queries(
    project_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Lists tracked search queries for a project with their latest check outcomes."""
    _verify_project_ownership(project_id, current_user["id"])
    supabase = get_supabase_admin()

    queries_res = (
        supabase.table("ai_search_queries")
        .select("*")
        .eq("project_id", project_id)
        .order("created_at", desc=False)
        .execute()
    )
    raw_queries = queries_res.data or []

    results: List[TrackedQueryOut] = []
    for q in raw_queries:
        # Fetch latest checks for each provider on this query
        checks_res = (
            supabase.table("ai_visibility_checks")
            .select("provider, brand_mentioned, website_cited, status, model, timestamp")
            .eq("query_id", q["id"])
            .order("timestamp", desc=True)
            .limit(10)
            .execute()
        )
        checks = checks_res.data or []

        # Deduplicate to latest per provider
        latest_by_provider: Dict[str, Any] = {}
        for c in checks:
            p = c["provider"]
            if p not in latest_by_provider:
                latest_by_provider[p] = c

        results.append(
            TrackedQueryOut(
                id=q["id"],
                project_id=q["project_id"],
                query=q["query"],
                category=q["category"],
                target_entity=q.get("target_entity"),
                enabled=q.get("enabled", True),
                created_at=q["created_at"],
                updated_at=q["updated_at"],
                latest_visibility=latest_by_provider,
            )
        )

    return results


@router.post("/queries", response_model=TrackedQueryOut, status_code=status.HTTP_201_CREATED)
async def create_tracked_query(
    project_id: str,
    payload: TrackedQueryCreate,
    current_user: dict = Depends(get_current_user),
):
    """Creates a new tracked query for multi-provider AI search visibility testing."""
    _verify_project_ownership(project_id, current_user["id"])
    supabase = get_supabase_admin()

    insert_res = (
        supabase.table("ai_search_queries")
        .insert(
            {
                "project_id": project_id,
                "query": payload.query.strip(),
                "category": payload.category.strip() or "general",
                "target_entity": payload.target_entity.strip() if payload.target_entity else None,
            }
        )
        .execute()
    )

    if not insert_res.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create tracked query",
        )

    row = insert_res.data[0]
    return TrackedQueryOut(
        id=row["id"],
        project_id=row["project_id"],
        query=row["query"],
        category=row["category"],
        target_entity=row.get("target_entity"),
        enabled=row.get("enabled", True),
        created_at=row["created_at"],
        updated_at=row["updated_at"],
        latest_visibility={},
    )


@router.delete("/queries/{query_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_tracked_query(
    project_id: str,
    query_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Deletes a tracked query and its associated checks and citations."""
    _verify_project_ownership(project_id, current_user["id"])
    supabase = get_supabase_admin()

    supabase.table("ai_search_queries").delete().eq("id", query_id).eq("project_id", project_id).execute()
    return None


@router.post("/check", response_model=QueryVisibilitySummary)
async def execute_visibility_check(
    project_id: str,
    payload: VisibilityCheckTrigger,
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    """Executes a multi-provider AI visibility check for a specific tracked query."""
    project = _verify_project_ownership(project_id, current_user["id"])
    supabase = get_supabase_admin()

    # Fetch query
    query_res = (
        supabase.table("ai_search_queries")
        .select("*")
        .eq("id", payload.query_id)
        .eq("project_id", project_id)
        .single()
        .execute()
    )
    if not query_res.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Query not found")

    q = query_res.data
    target_brand = q.get("target_entity") or project.get("name") or ""
    website_url = project.get("website_url") or ""

    auth_header = request.headers.get("Authorization", "")
    token = auth_header.split(" ", 1)[1] if auth_header.startswith("Bearer ") else None

    analyzer = GEOVisibilityAnalyzer()
    summary = await analyzer.check_query(
        project_id=project_id,
        query_id=payload.query_id,
        query_text=q["query"],
        target_brand=target_brand,
        target_domain=website_url,
        category=q.get("category", "general"),
        competitor_domains=payload.competitor_domains,
        access_token=token,
    )

    return summary


@router.get("/checks/{query_id}")
async def get_query_check_history(
    project_id: str,
    query_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Retrieves all past visibility check responses and citations for a specific query."""
    _verify_project_ownership(project_id, current_user["id"])
    supabase = get_supabase_admin()

    checks_res = (
        supabase.table("ai_visibility_checks")
        .select("*")
        .eq("query_id", query_id)
        .eq("project_id", project_id)
        .order("timestamp", desc=True)
        .execute()
    )
    checks = checks_res.data or []

    # Attach citations
    for c in checks:
        cit_res = (
            supabase.table("ai_citations")
            .select("*")
            .eq("visibility_check_id", c["id"])
            .order("citation_order", desc=False)
            .execute()
        )
        c["citations"] = cit_res.data or []

    return checks


@router.post("/research")
async def execute_tavily_research(
    project_id: str,
    payload: CompetitorResearchRequest,
    current_user: dict = Depends(get_current_user),
):
    """Executes public web research and competitor presence search via Tavily."""
    project = _verify_project_ownership(project_id, current_user["id"])
    website_url = project.get("website_url", "")

    tavily = TavilyResearchService()
    return await tavily.search_baseline(
        query=payload.query,
        target_domain=website_url,
        competitor_domains=payload.competitor_domains,
    )
