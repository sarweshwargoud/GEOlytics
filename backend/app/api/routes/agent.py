"""API endpoints for LangGraph intelligence pipeline runs and Hindsight agent memory."""

import time
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status

from app.core.auth import get_current_user
from app.core.database import get_supabase_admin
from app.services.agent import (
    AgentRunResponse,
    HindsightMemoryService,
    MemoryOut,
    run_intelligence_pipeline,
)

router = APIRouter(prefix="/projects/{project_id}", tags=["Agent Intelligence & Memory"])


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


@router.post("/agent/run", response_model=AgentRunResponse)
async def run_agent_pipeline(
    project_id: str,
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    """
    Executes the LangGraph intelligence pipeline for a project:
    Collects crawl & GSC & GEO data -> Analyzes -> Researches competitors -> Recalls Hindsight memory ->
    Reasons -> Generates actionable recommendations -> Validates -> Persists.
    """
    project = _verify_project_ownership(project_id, current_user["id"])

    # Extract user access token for RLS if passed
    auth_header = request.headers.get("Authorization", "")
    access_token = auth_header.replace("Bearer ", "").strip() if "Bearer " in auth_header else None

    start_time = time.time()
    final_state = await run_intelligence_pipeline(
        project_id=project_id,
        project_name=project["name"],
        website_url=project["website_url"],
        target_brand=project["name"],
        user_access_token=access_token,
    )
    duration = round(time.time() - start_time, 2)

    saved_recs = final_state.get("saved_recommendations", [])
    recalled_mems = final_state.get("recalled_memories", [])

    return AgentRunResponse(
        project_id=project_id,
        recommendations_generated=len(saved_recs),
        recommendations=saved_recs,
        memories_recalled=len(recalled_mems),
        execution_time_seconds=duration,
        summary=(
            f"Successfully executed 9-node LangGraph pipeline in {duration}s. "
            f"Recalled {len(recalled_mems)} historical memories, generated and validated {len(saved_recs)} recommendations."
        ),
    )


@router.get("/memory", response_model=List[MemoryOut])
async def get_project_memories(
    project_id: str,
    category: Optional[str] = Query(None, description="Filter by category: seo, geo, technical, content, approval"),
    limit: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
):
    """
    Returns long-term agent memories and learned experiences for this project.
    """
    _verify_project_ownership(project_id, current_user["id"])
    hindsight = HindsightMemoryService()
    await hindsight.seed_baseline_memories_if_empty(project_id)

    supabase = get_supabase_admin()
    query = (
        supabase.table("agent_memories")
        .select("*")
        .eq("project_id", project_id)
    )
    if category:
        query = query.eq("category", category)

    res = query.order("created_at", desc=True).limit(limit).execute()
    return res.data or []
