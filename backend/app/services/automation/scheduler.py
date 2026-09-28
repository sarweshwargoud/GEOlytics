"""Decoupled scheduling abstraction for GEOlytics.

Independent of the underlying trigger mechanism (cron, Supabase scheduled function,
n8n, or internal background worker).
"""

import asyncio
from datetime import datetime, timezone
import logging
from typing import Any, Dict, List
from app.core.database import get_supabase_admin
from app.services.automation.service import AutomationService

logger = logging.getLogger(__name__)


class AutomationScheduler:
    """Orchestrates detection and dispatching of due automation jobs."""

    @classmethod
    async def check_and_run_due_jobs(cls) -> Dict[str, Any]:
        """
        Scans all projects for automation jobs that are enabled and whose next_run_at timestamp has passed.
        Executes due jobs with full failure isolation.
        """
        supabase = get_supabase_admin()
        now = datetime.now(timezone.utc)

        # Query due jobs
        due_res = (
            supabase.table("automation_settings")
            .select("*, projects(id, user_id)")
            .eq("enabled", True)
            .lte("next_run_at", now.isoformat())
            .execute()
        )
        due_jobs = due_res.data or []

        executed_count = 0
        failed_count = 0
        run_summaries = []

        for setting in due_jobs:
            project = setting.get("projects") or {}
            project_id = setting.get("project_id")
            user_id = project.get("user_id")
            job_type = setting.get("job_type")

            if not project_id or not user_id or not job_type:
                continue

            try:
                logger.info("Executing scheduled job '%s' for project %s", job_type, project_id)
                res = await AutomationService.execute_job(
                    project_id=project_id,
                    job_type=job_type,
                    user_id=user_id,
                    is_manual=False,
                )
                executed_count += 1
                run_summaries.append({
                    "project_id": project_id,
                    "job_type": job_type,
                    "status": res.get("status"),
                })
            except Exception as e:
                failed_count += 1
                logger.error("Error executing scheduled job %s for project %s: %s", job_type, project_id, e)

        return {
            "due_jobs_found": len(due_jobs),
            "executed_count": executed_count,
            "failed_count": failed_count,
            "runs": run_summaries,
            "timestamp": now.isoformat(),
        }
