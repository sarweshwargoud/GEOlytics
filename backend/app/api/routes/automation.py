"""API routes for project automation settings, manual job triggers, execution logs, and health."""

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.auth import get_current_user
from app.services.automation.models import (
    AutomationJobSetting,
    AutomationJobSettingUpdate,
    AutomationRunLog,
    JobType,
    ManualRunRequest,
    ProjectHealthReport,
)
from app.services.automation.scheduler import AutomationScheduler
from app.services.automation.service import AutomationService

project_automation_router = APIRouter(prefix="/projects/{project_id}", tags=["Automation"])
system_automation_router = APIRouter(prefix="/automation", tags=["Automation"])


@project_automation_router.get("/automation/settings", response_model=List[AutomationJobSetting])
async def get_automation_settings(
    project_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Retrieves all automation job configurations for a project, seeding defaults if needed."""
    AutomationService._verify_project_ownership(project_id, current_user["id"])
    return await AutomationService.get_or_create_default_settings(project_id)


@project_automation_router.put("/automation/settings/{job_type}", response_model=AutomationJobSetting)
async def update_automation_setting(
    project_id: str,
    job_type: str,
    payload: AutomationJobSettingUpdate,
    current_user: dict = Depends(get_current_user),
):
    """Updates frequency, enabled status, or configuration for a specific automation job."""
    return await AutomationService.update_job_setting(
        project_id=project_id,
        job_type=job_type,
        payload=payload,
        user_id=current_user["id"],
    )


@project_automation_router.get("/automation/runs", response_model=List[AutomationRunLog])
async def list_automation_runs(
    project_id: str,
    limit: int = Query(30, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
):
    """Lists historical execution logs and telemetry for automation runs."""
    return await AutomationService.list_runs(
        project_id=project_id,
        user_id=current_user["id"],
        limit=limit,
    )


@project_automation_router.post("/automation/run/{job_type}")
async def run_automation_job_manually(
    project_id: str,
    job_type: JobType,
    payload: ManualRunRequest = ManualRunRequest(),
    current_user: dict = Depends(get_current_user),
):
    """
    Manually triggers any automation job immediately using the shared service layer.
    Safe against partial failures.
    """
    return await AutomationService.execute_job(
        project_id=project_id,
        job_type=job_type,
        user_id=current_user["id"],
        force=payload.force,
        is_manual=True,
    )


@project_automation_router.get("/health", response_model=ProjectHealthReport)
async def get_project_health(
    project_id: str,
    current_user: dict = Depends(get_current_user),
):
    """
    Returns transparent, component-wise health and data freshness for SEO, GEO, GSC, Experiments, and Automation.
    No arbitrary 0-100 combined AI score.
    """
    return await AutomationService.get_project_health(
        project_id=project_id,
        user_id=current_user["id"],
    )


@system_automation_router.post("/check-due")
async def trigger_due_jobs_check():
    """
    External scheduler / cron entry point. Scans all enabled projects and executes due jobs.
    """
    return await AutomationScheduler.check_and_run_due_jobs()
