"""API endpoints for recommendation listing, inspection, approval, and rejection."""

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status

from app.core.auth import get_current_user
from app.core.database import get_supabase_admin
from app.services.agent import (
    RecommendationApprovalService,
    RecommendationOut,
    RecommendationRejectRequest,
)

project_recs_router = APIRouter(prefix="/projects/{project_id}/recommendations", tags=["Recommendations"])
recs_action_router = APIRouter(prefix="/recommendations", tags=["Recommendations"])


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


@project_recs_router.get("", response_model=List[RecommendationOut])
async def list_recommendations(
    project_id: str,
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by status: pending, approved, rejected, implemented, measuring"),
    priority_filter: Optional[str] = Query(None, alias="priority", description="Filter by priority: critical, high, medium, low"),
    type_filter: Optional[str] = Query(None, alias="type", description="Filter by type: content, technical, schema, linking, geo_visibility, metadata"),
    current_user: dict = Depends(get_current_user),
):
    """Lists recommendations generated for a project with optional filters."""
    _verify_project_ownership(project_id, current_user["id"])
    supabase = get_supabase_admin()

    query = (
        supabase.table("recommendations")
        .select("*")
        .eq("project_id", project_id)
    )

    if status_filter:
        query = query.eq("status", status_filter)
    if priority_filter:
        query = query.eq("priority", priority_filter)
    if type_filter:
        query = query.eq("type", type_filter)

    res = query.order("created_at", desc=True).execute()
    return res.data or []


@recs_action_router.get("/{recommendation_id}", response_model=RecommendationOut)
async def get_recommendation_detail(
    recommendation_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Retrieves full detail of a specific recommendation."""
    rec = await RecommendationApprovalService.get_recommendation(recommendation_id, current_user["id"])
    return rec


@recs_action_router.post("/{recommendation_id}/approve", response_model=RecommendationOut)
async def approve_recommendation(
    recommendation_id: str,
    current_user: dict = Depends(get_current_user),
):
    """
    Approves a recommendation for execution.
    Logs human approval into Hindsight memory.
    """
    rec = await RecommendationApprovalService.approve(recommendation_id, current_user["id"])
    return rec


@recs_action_router.post("/{recommendation_id}/reject", response_model=RecommendationOut)
async def reject_recommendation(
    recommendation_id: str,
    payload: RecommendationRejectRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Rejects a recommendation with a documented reason.
    Logs feedback constraint into Hindsight memory so future reasoning avoids repeating it.
    """
    rec = await RecommendationApprovalService.reject(recommendation_id, payload.reason, current_user["id"])
    return rec
