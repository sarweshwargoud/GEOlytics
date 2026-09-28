"""API routes for Google Search Console OAuth, data synchronization, and search performance reports."""

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel

from app.core.auth import get_current_user
from app.core.database import get_supabase_admin
from app.services.gsc.models import SearchPerformanceReport
from app.services.gsc.service import GoogleSearchConsoleService

router = APIRouter(prefix="/projects/{project_id}/gsc", tags=["Google Search Console"])
oauth_callback_router = APIRouter(prefix="/gsc", tags=["Google Search Console"])


class ConnectPropertyRequest(BaseModel):
    site_url: str
    access_token: str
    refresh_token: Optional[str] = None


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


@router.get("/auth-url")
async def get_gsc_auth_url(
    project_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Generates Google Search Console OAuth 2.0 authorization URL."""
    _verify_project_ownership(project_id, current_user["id"])
    if not GoogleSearchConsoleService.is_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google Search Console OAuth is not configured on this server (GSC_CLIENT_ID / GSC_CLIENT_SECRET missing).",
        )
    url = GoogleSearchConsoleService.generate_auth_url(project_id)
    return {"auth_url": url}


@oauth_callback_router.get("/callback")
async def handle_gsc_oauth_callback(
    code: str,
    state: str,  # state carries project_id
):
    """Handles OAuth redirection from Google, exchanging code for tokens."""
    try:
        tokens = await GoogleSearchConsoleService.exchange_code_for_tokens(code)
        # In a real browser flow, redirect to frontend setup page with temporary state token
        return {
            "status": "authorized",
            "project_id": state,
            "access_token": tokens.get("access_token"),
            "refresh_token": tokens.get("refresh_token"),
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/sites")
async def list_gsc_verified_sites(
    project_id: str,
    access_token: str = Query(..., description="Access token obtained from OAuth"),
    current_user: dict = Depends(get_current_user),
):
    """Lists verified sites in user's Search Console account."""
    _verify_project_ownership(project_id, current_user["id"])
    try:
        sites = await GoogleSearchConsoleService.list_verified_sites(access_token)
        return {"sites": sites}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/connect")
async def connect_gsc_property(
    project_id: str,
    payload: ConnectPropertyRequest,
    current_user: dict = Depends(get_current_user),
):
    """Connects a verified Search Console property to the project."""
    _verify_project_ownership(project_id, current_user["id"])
    supabase = get_supabase_admin()

    upsert_res = (
        supabase.table("search_console_connections")
        .upsert(
            {
                "project_id": project_id,
                "site_url": payload.site_url.strip(),
                "access_token": payload.access_token,
                "refresh_token": payload.refresh_token,
            },
            on_conflict="project_id",
        )
        .execute()
    )

    return {"status": "connected", "site_url": payload.site_url}


@router.post("/sync")
async def trigger_gsc_sync(
    project_id: str,
    days: int = Query(30, ge=7, le=90),
    request: Request = None,
    current_user: dict = Depends(get_current_user),
):
    """Synchronizes search performance data from Search Console for the project."""
    _verify_project_ownership(project_id, current_user["id"])

    auth_header = request.headers.get("Authorization", "") if request else ""
    token = auth_header.split(" ", 1)[1] if auth_header.startswith("Bearer ") else None

    try:
        sync_result = await GoogleSearchConsoleService.sync_project_performance(
            project_id=project_id,
            days=days,
            access_token=token,
        )
        return sync_result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/performance", response_model=SearchPerformanceReport)
async def get_gsc_performance(
    project_id: str,
    days: int = Query(30, ge=7, le=90),
    request: Request = None,
    current_user: dict = Depends(get_current_user),
):
    """Retrieves aggregated Search Console performance metrics, charts, queries, and pages."""
    _verify_project_ownership(project_id, current_user["id"])

    auth_header = request.headers.get("Authorization", "") if request else ""
    token = auth_header.split(" ", 1)[1] if auth_header.startswith("Bearer ") else None

    return await GoogleSearchConsoleService.get_performance_report(
        project_id=project_id,
        days=days,
        access_token=token,
    )
