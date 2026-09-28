"""API endpoints for crawling websites and retrieving SEO audit results."""

from typing import List, Optional
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request, status

from app.core.auth import get_current_user
from app.core.database import get_supabase_admin
from app.schemas.crawl import (
    AuditOverviewOut,
    CrawlPageOut,
    CrawlRunOut,
    CrawlTriggerRequest,
    SEOIssueOut,
)
from app.services.crawl_runner import run_crawl_job

router = APIRouter(prefix="/projects/{project_id}", tags=["Crawl & Audit"])


def _verify_project_ownership(project_id: str, user_id: str) -> dict:
    """Verifies that the project exists and belongs to the authenticated user."""
    supabase = get_supabase_admin()
    res = (
        supabase.table("projects")
        .select("*")
        .eq("id", project_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not res.data or len(res.data) == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found or unauthorized",
        )
    return res.data[0]


@router.post("/crawl", response_model=CrawlRunOut, status_code=status.HTTP_202_ACCEPTED)
async def trigger_crawl(
    project_id: str,
    payload: CrawlTriggerRequest,
    background_tasks: BackgroundTasks,
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    """Triggers an asynchronous website crawl and SEO audit for the project."""
    project = _verify_project_ownership(project_id, current_user["id"])
    website_url = project.get("website_url")
    if not website_url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Project has no website_url configured",
        )

    # Extract user bearer token
    auth_header = request.headers.get("Authorization", "")
    token = auth_header.split(" ", 1)[1] if auth_header.startswith("Bearer ") else None

    from app.core.config import get_settings
    from supabase import create_client

    s = get_settings()
    if s.supabase_service_role_key:
        supabase = get_supabase_admin()
    elif token:
        supabase = create_client(s.supabase_url, s.supabase_anon_key)
        supabase.postgrest.auth(token)
    else:
        supabase = get_supabase_admin()

    # Create crawl_run record
    insert_res = (
        supabase.table("crawl_runs")
        .insert(
            {
                "project_id": project_id,
                "status": "queued",
            }
        )
        .execute()
    )

    if not insert_res.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to initialize crawl run",
        )

    crawl_run = insert_res.data[0]
    crawl_run_id = crawl_run["id"]

    # Enqueue background task
    background_tasks.add_task(
        run_crawl_job,
        project_id=project_id,
        crawl_run_id=crawl_run_id,
        website_url=website_url,
        max_pages=payload.max_pages,
        max_depth=payload.max_depth,
        access_token=token,
    )

    return crawl_run


@router.get("/crawl-runs", response_model=List[CrawlRunOut])
async def list_crawl_runs(
    project_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Lists all crawl runs for a project ordered by creation time descending."""
    _verify_project_ownership(project_id, current_user["id"])
    supabase = get_supabase_admin()

    res = (
        supabase.table("crawl_runs")
        .select("*")
        .eq("project_id", project_id)
        .order("created_at", desc=True)
        .limit(20)
        .execute()
    )

    return res.data or []


@router.get("/crawl-runs/{run_id}", response_model=CrawlRunOut)
async def get_crawl_run(
    project_id: str,
    run_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Retrieves status and summary of a specific crawl run."""
    _verify_project_ownership(project_id, current_user["id"])
    supabase = get_supabase_admin()

    res = (
        supabase.table("crawl_runs")
        .select("*")
        .eq("id", run_id)
        .eq("project_id", project_id)
        .execute()
    )

    if not res.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Crawl run not found")

    return res.data[0]


@router.get("/audit", response_model=AuditOverviewOut)
async def get_latest_audit(
    project_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Retrieves the latest completed SEO audit overview for the project."""
    _verify_project_ownership(project_id, current_user["id"])
    supabase = get_supabase_admin()

    # Get latest completed crawl run (or latest run in general)
    run_res = (
        supabase.table("crawl_runs")
        .select("*")
        .eq("project_id", project_id)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )

    if not run_res.data:
        return AuditOverviewOut()

    latest_run = run_res.data[0]
    run_id = latest_run["id"]

    # Tally issues
    issues_res = (
        supabase.table("seo_issues")
        .select("severity")
        .eq("crawl_run_id", run_id)
        .execute()
    )

    issues = issues_res.data or []
    crit = sum(1 for i in issues if i.get("severity") == "critical")
    high = sum(1 for i in issues if i.get("severity") == "high")
    med = sum(1 for i in issues if i.get("severity") == "medium")
    low = sum(1 for i in issues if i.get("severity") == "low")

    return AuditOverviewOut(
        latest_run=latest_run,
        total_pages_crawled=latest_run.get("pages_crawled", 0),
        total_issues=len(issues),
        critical_issues=crit,
        high_issues=high,
        medium_issues=med,
        low_issues=low,
        seo_health_score=latest_run.get("seo_health_score"),
        category_scores=latest_run.get("category_scores", {}),
        site_signals=latest_run.get("site_signals", {}),
    )


@router.get("/audit/issues", response_model=List[SEOIssueOut])
async def list_audit_issues(
    project_id: str,
    run_id: Optional[str] = Query(None, description="Specific crawl run ID. Defaults to latest."),
    severity: Optional[str] = Query(None, description="Filter by severity (critical, high, medium, low)"),
    category: Optional[str] = Query(None, description="Filter by category"),
    current_user: dict = Depends(get_current_user),
):
    """Lists detected SEO issues with evidence and recommendations."""
    _verify_project_ownership(project_id, current_user["id"])
    supabase = get_supabase_admin()

    target_run_id = run_id
    if not target_run_id:
        latest = (
            supabase.table("crawl_runs")
            .select("id")
            .eq("project_id", project_id)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        if not latest.data:
            return []
        target_run_id = latest.data[0]["id"]

    query = supabase.table("seo_issues").select("*").eq("crawl_run_id", target_run_id)
    if severity:
        query = query.eq("severity", severity.lower())
    if category:
        query = query.eq("category", category.lower())

    res = query.order("created_at", desc=False).execute()
    return res.data or []


@router.get("/audit/pages", response_model=List[CrawlPageOut])
async def list_crawled_pages(
    project_id: str,
    run_id: Optional[str] = Query(None, description="Specific crawl run ID. Defaults to latest."),
    current_user: dict = Depends(get_current_user),
):
    """Lists all crawled pages with metadata, status codes, and headings."""
    _verify_project_ownership(project_id, current_user["id"])
    supabase = get_supabase_admin()

    target_run_id = run_id
    if not target_run_id:
        latest = (
            supabase.table("crawl_runs")
            .select("id")
            .eq("project_id", project_id)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        if not latest.data:
            return []
        target_run_id = latest.data[0]["id"]

    res = (
        supabase.table("crawl_pages")
        .select("*")
        .eq("crawl_run_id", target_run_id)
        .order("status_code", desc=False)
        .execute()
    )

    return res.data or []


@router.get("/audit/pages/{page_id}", response_model=CrawlPageOut)
async def get_crawled_page_detail(
    project_id: str,
    page_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Retrieves deep-dive data for a single crawled page."""
    _verify_project_ownership(project_id, current_user["id"])
    supabase = get_supabase_admin()

    res = (
        supabase.table("crawl_pages")
        .select("*")
        .eq("id", page_id)
        .eq("project_id", project_id)
        .execute()
    )

    if not res.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Page not found")

    return res.data[0]
