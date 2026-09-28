"""API routes for periodic intelligence reports."""

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.auth import get_current_user
from app.core.database import get_supabase_admin
from app.services.automation.jobs import job_generate_project_report
from app.services.automation.models import GenerateReportRequest, ReportOut
from app.services.automation.service import AutomationService

reports_router = APIRouter(tags=["Reports"])


@reports_router.get("/projects/{project_id}/reports", response_model=List[ReportOut])
async def list_reports(
    project_id: str,
    limit: int = Query(20, ge=1, le=50),
    current_user: dict = Depends(get_current_user),
):
    """Lists periodic intelligence reports generated for a project."""
    AutomationService._verify_project_ownership(project_id, current_user["id"])
    supabase = get_supabase_admin()
    res = (
        supabase.table("reports")
        .select("*")
        .eq("project_id", project_id)
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return res.data or []


@reports_router.post("/projects/{project_id}/reports/generate", response_model=ReportOut)
async def generate_report_now(
    project_id: str,
    payload: GenerateReportRequest = GenerateReportRequest(),
    current_user: dict = Depends(get_current_user),
):
    """Generates an intelligence report on demand for the specified period."""
    AutomationService._verify_project_ownership(project_id, current_user["id"])
    res = await job_generate_project_report(
        project_id=project_id,
        user_id=current_user["id"],
        period_days=payload.period_days,
        report_type=payload.report_type,
    )

    if res.get("status") == "failed" or not res.get("report_id"):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=res.get("message", "Failed to generate report"),
        )

    supabase = get_supabase_admin()
    report_res = supabase.table("reports").select("*").eq("id", res["report_id"]).execute()
    if not report_res.data:
        raise HTTPException(status_code=404, detail="Generated report record not found")
    return report_res.data[0]


@reports_router.get("/reports/{report_id}", response_model=ReportOut)
async def get_report_detail(
    report_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Retrieves full detail of a specific intelligence report."""
    supabase = get_supabase_admin()
    res = (
        supabase.table("reports")
        .select("*, projects(user_id)")
        .eq("id", report_id)
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail="Report not found")

    report = res.data[0]
    project = report.get("projects") or {}
    if project.get("user_id") != current_user["id"]:
        raise HTTPException(status_code=403, detail="Unauthorized access to this report")

    return report
