"""Automation orchestration service: execution, logging, scheduling, notifications, and health."""

from datetime import datetime, timedelta, timezone
import logging
from typing import Any, Dict, List, Optional, Tuple
from fastapi import HTTPException, status

from app.core.database import get_supabase_admin
from app.services.automation.jobs import (
    job_generate_project_report,
    job_measure_active_experiments,
    job_research_competitors,
    job_run_geo_visibility_checks,
    job_run_intelligence_agent,
    job_run_seo_audit,
    job_sync_search_console,
)
from app.services.automation.models import (
    AutomationJobSetting,
    AutomationJobSettingUpdate,
    AutomationRunLog,
    FreshnessIndicator,
    JobFrequency,
    JobType,
    NotificationCategory,
    NotificationOut,
    NotificationPreferencesModel,
    NotificationPreferencesUpdate,
    ProjectHealthReport,
    ReportOut,
)

logger = logging.getLogger(__name__)

DEFAULT_JOB_CONFIGS = [
    {"job_type": "seo_sync", "frequency": "daily", "enabled": True},
    {"job_type": "geo_checks", "frequency": "daily", "enabled": True},
    {"job_type": "seo_audit", "frequency": "weekly", "enabled": True},
    {"job_type": "competitor_research", "frequency": "weekly", "enabled": True},
    {"job_type": "agent_analysis", "frequency": "weekly", "enabled": True},
    {"job_type": "experiment_measurement", "frequency": "daily", "enabled": True},
    {"job_type": "report_generation", "frequency": "weekly", "enabled": True},
]


class AutomationService:
    """Core service for managing automation settings, running jobs with failure isolation, and project health."""

    @classmethod
    def _verify_project_ownership(cls, project_id: str, user_id: str) -> dict:
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

    @classmethod
    def compute_next_run(cls, frequency: JobFrequency, from_time: Optional[datetime] = None) -> datetime:
        base = from_time or datetime.now(timezone.utc)
        if frequency == "hourly":
            return base + timedelta(hours=1)
        elif frequency == "daily":
            return base + timedelta(days=1)
        elif frequency == "weekly":
            return base + timedelta(days=7)
        elif frequency == "monthly":
            return base + timedelta(days=30)
        return base + timedelta(days=1)

    @classmethod
    async def get_or_create_default_settings(cls, project_id: str) -> List[Dict[str, Any]]:
        """Ensures all 7 standard jobs have registered settings for the project."""
        supabase = get_supabase_admin()
        res = supabase.table("automation_settings").select("*").eq("project_id", project_id).execute()
        existing = {r["job_type"]: r for r in (res.data or [])}

        to_insert = []
        now = datetime.now(timezone.utc)
        for cfg in DEFAULT_JOB_CONFIGS:
            jt = cfg["job_type"]
            if jt not in existing:
                next_run = cls.compute_next_run(cfg["frequency"], now)
                to_insert.append({
                    "project_id": project_id,
                    "job_type": jt,
                    "enabled": cfg["enabled"],
                    "frequency": cfg["frequency"],
                    "last_run_at": None,
                    "next_run_at": next_run.isoformat(),
                    "configuration": {},
                })

        if to_insert:
            try:
                supabase.table("automation_settings").insert(to_insert).execute()
                res = supabase.table("automation_settings").select("*").eq("project_id", project_id).execute()
            except Exception as e:
                logger.error("Failed to seed default automation settings: %s", e)

        return res.data or []

    @classmethod
    async def update_job_setting(
        cls,
        project_id: str,
        job_type: str,
        payload: AutomationJobSettingUpdate,
        user_id: str,
    ) -> Dict[str, Any]:
        """Updates frequency, enabled status, or configuration for an automation job."""
        cls._verify_project_ownership(project_id, user_id)
        supabase = get_supabase_admin()

        # Ensure setting exists
        await cls.get_or_create_default_settings(project_id)

        update_dict: Dict[str, Any] = {"updated_at": datetime.now(timezone.utc).isoformat()}
        if payload.enabled is not None:
            update_dict["enabled"] = payload.enabled
        if payload.frequency is not None:
            update_dict["frequency"] = payload.frequency
            update_dict["next_run_at"] = cls.compute_next_run(payload.frequency).isoformat()
        if payload.configuration is not None:
            update_dict["configuration"] = payload.configuration

        res = (
            supabase.table("automation_settings")
            .update(update_dict)
            .eq("project_id", project_id)
            .eq("job_type", job_type)
            .execute()
        )
        if not res.data:
            raise HTTPException(status_code=404, detail="Job setting not found")
        return res.data[0]

    @classmethod
    async def list_runs(cls, project_id: str, user_id: str, limit: int = 30) -> List[Dict[str, Any]]:
        """Lists historical execution logs for a project."""
        cls._verify_project_ownership(project_id, user_id)
        supabase = get_supabase_admin()
        res = (
            supabase.table("automation_runs")
            .select("*")
            .eq("project_id", project_id)
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        return res.data or []

    @classmethod
    async def execute_job(
        cls,
        project_id: str,
        job_type: JobType,
        user_id: str,
        force: bool = False,
        is_manual: bool = False,
    ) -> Dict[str, Any]:
        """
        Executes a job with failure isolation and structured logging in automation_runs.
        Safe for repeated execution.
        """
        cls._verify_project_ownership(project_id, user_id)
        supabase = get_supabase_admin()
        start_time = datetime.now(timezone.utc)

        # 1. Log run start
        run_record = {
            "project_id": project_id,
            "job_type": job_type,
            "status": "running",
            "started_at": start_time.isoformat(),
            "metadata": {"is_manual": is_manual, "force": force},
        }
        run_res = supabase.table("automation_runs").insert(run_record).execute()
        run_id = run_res.data[0]["id"] if run_res.data else None

        result: Dict[str, Any] = {}
        job_status = "completed"
        error_msg: Optional[str] = None

        try:
            if job_type == "seo_sync":
                result = await job_sync_search_console(project_id, user_id)
            elif job_type == "geo_checks":
                result = await job_run_geo_visibility_checks(project_id, user_id)
            elif job_type == "seo_audit":
                result = await job_run_seo_audit(project_id, user_id, force=force)
            elif job_type == "competitor_research":
                result = await job_research_competitors(project_id, user_id)
            elif job_type == "agent_analysis":
                result = await job_run_intelligence_agent(project_id, user_id)
            elif job_type == "experiment_measurement":
                result = await job_measure_active_experiments(project_id, user_id)
            elif job_type == "report_generation":
                result = await job_generate_project_report(project_id, user_id)
            else:
                raise ValueError(f"Unknown job type: {job_type}")

            job_status = result.get("status", "completed")
            if job_status == "failed":
                error_msg = result.get("message")
        except Exception as e:
            logger.error("Job %s crashed for project %s: %s", job_type, project_id, e)
            job_status = "failed"
            error_msg = str(e)
            result = {"status": "failed", "message": str(e), "error": str(e)}

        end_time = datetime.now(timezone.utc)
        duration = round((end_time - start_time).total_seconds(), 2)

        # 2. Update run log
        if run_id:
            try:
                supabase.table("automation_runs").update({
                    "status": job_status,
                    "completed_at": end_time.isoformat(),
                    "duration_seconds": duration,
                    "result_summary": result.get("message", "Job finished."),
                    "error_message": error_msg,
                    "metadata": {"result": result, "is_manual": is_manual},
                }).eq("id", run_id).execute()
            except Exception as e:
                logger.error("Failed to update automation run log: %s", e)

        # 3. Update job settings last_run_at and next_run_at
        try:
            settings_res = (
                supabase.table("automation_settings")
                .select("frequency")
                .eq("project_id", project_id)
                .eq("job_type", job_type)
                .execute()
            )
            freq = settings_res.data[0]["frequency"] if settings_res.data else "daily"
            next_run = cls.compute_next_run(freq, end_time)

            supabase.table("automation_settings").update({
                "last_run_at": end_time.isoformat(),
                "next_run_at": next_run.isoformat(),
                "updated_at": end_time.isoformat(),
            }).eq("project_id", project_id).eq("job_type", job_type).execute()
        except Exception as e:
            logger.warning("Could not update job next_run_at: %s", e)

        # 4. Dispatch Notifications based on meaningful events
        await cls._handle_notifications_for_job(
            project_id=project_id,
            user_id=user_id,
            job_type=job_type,
            job_status=job_status,
            result=result,
        )

        return {
            "run_id": run_id,
            "job_type": job_type,
            "status": job_status,
            "duration_seconds": duration,
            "summary": result.get("message"),
            "result": result,
        }

    @classmethod
    async def _handle_notifications_for_job(
        cls,
        project_id: str,
        user_id: str,
        job_type: str,
        job_status: str,
        result: Dict[str, Any],
    ) -> None:
        """Dispatches in-app notifications if meaningful event occurs and user preferences allow."""
        prefs = await cls.get_notification_preferences(project_id, user_id)

        # Failure notification
        if job_status == "failed" and prefs.get("automation_failures", True):
            await cls.create_notification(
                project_id=project_id,
                user_id=user_id,
                category="system",
                title=f"Automation Job Failed: {job_type.replace('_', ' ').title()}",
                message=result.get("message", "Job encountered an unexpected error."),
            )

        # Report ready notification
        if job_type == "report_generation" and job_status == "completed" and prefs.get("weekly_reports", True):
            await cls.create_notification(
                project_id=project_id,
                user_id=user_id,
                category="report",
                title="Weekly Intelligence Report Ready",
                message=f"Your intelligence summary for project is compiled. {result.get('period', '')}",
                related_entity_id=result.get("report_id"),
                related_entity_type="report",
            )

        # Experiments completed notification
        if job_type == "experiment_measurement" and result.get("completed_count", 0) > 0 and prefs.get("experiment_results", True):
            await cls.create_notification(
                project_id=project_id,
                user_id=user_id,
                category="experiment",
                title=f"{result.get('completed_count')} Experiment(s) Completed Measurement",
                message="Evaluation windows have concluded. Verified outcomes and Hindsight learnings are ready.",
            )

        # Agent recommendations notification
        if job_type == "agent_analysis" and result.get("recommendations_generated", 0) > 0 and prefs.get("high_priority_recs", True):
            await cls.create_notification(
                project_id=project_id,
                user_id=user_id,
                category="recommendation",
                title=f"{result.get('recommendations_generated')} New Recommendations Generated",
                message="LangGraph pipeline analyzed recent search and citation trends. Review proposals for approval.",
            )

    @classmethod
    async def get_project_health(cls, project_id: str, user_id: str) -> ProjectHealthReport:
        """
        Calculates transparent, honest health & data freshness for all core subsystems.
        Never computes a fake 0-100 combined AI score.
        """
        project = cls._verify_project_ownership(project_id, user_id)
        supabase = get_supabase_admin()
        now = datetime.now(timezone.utc)

        def _format_freshness(dt_str: Optional[str]) -> Tuple[str, bool]:
            if not dt_str:
                return ("Data unavailable", False)
            try:
                dt = datetime.fromisoformat(dt_str.replace("Z", "+00:00"))
                diff = now - dt
                hrs = diff.total_seconds() / 3600.0
                if hrs < 1.0:
                    mins = max(1, int(diff.total_seconds() / 60.0))
                    return (f"{mins}m ago", True)
                elif hrs < 24.0:
                    return (f"{int(hrs)}h ago", True)
                elif hrs < 48.0:
                    return ("Yesterday", True)
                else:
                    days = int(hrs / 24.0)
                    return (f"{days}d ago", False)
            except Exception:
                return ("Recorded", True)

        # 1. SEO Audit Freshness
        crawl_res = (
            supabase.table("crawl_runs")
            .select("completed_at, seo_health_score, pages_crawled")
            .eq("project_id", project_id)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        seo_crawl = crawl_res.data[0] if crawl_res.data else None
        seo_label, seo_fresh = _format_freshness(seo_crawl.get("completed_at") if seo_crawl else None)
        seo_indicator = FreshnessIndicator(
            last_updated=seo_crawl.get("completed_at") if seo_crawl else None,
            freshness_label=seo_label,
            is_fresh=seo_fresh,
            details=f"Health score: {seo_crawl.get('seo_health_score')}/100 ({seo_crawl.get('pages_crawled', 0)} pages crawled)" if seo_crawl else "No audits run yet",
        )

        # 2. GEO Visibility Freshness
        geo_res = (
            supabase.table("ai_visibility_checks")
            .select("created_at, provider")
            .eq("project_id", project_id)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        geo_check = geo_res.data[0] if geo_res.data else None
        geo_label, geo_fresh = _format_freshness(geo_check.get("created_at") if geo_check else None)
        geo_indicator = FreshnessIndicator(
            last_updated=geo_check.get("created_at") if geo_check else None,
            freshness_label=geo_label,
            is_fresh=geo_fresh,
            details=f"Last checked on {geo_check.get('provider')}" if geo_check else "No visibility checks recorded",
        )

        # 3. GSC Freshness
        gsc_conn_res = (
            supabase.table("search_console_connections")
            .select("last_sync_at, site_url")
            .eq("project_id", project_id)
            .execute()
        )
        gsc_conn = gsc_conn_res.data[0] if gsc_conn_res.data else None
        gsc_label, gsc_fresh = _format_freshness(gsc_conn.get("last_sync_at") if gsc_conn else None)
        gsc_indicator = FreshnessIndicator(
            last_updated=gsc_conn.get("last_sync_at") if gsc_conn else None,
            freshness_label=gsc_label if gsc_conn else "Disconnected",
            is_fresh=gsc_fresh if gsc_conn else False,
            details="48–72h natural reporting lag" if gsc_conn else "Connect in Search Console tab",
        )

        # 4. Experiments Status
        exps_res = (
            supabase.table("experiments")
            .select("status, outcome, updated_at")
            .eq("project_id", project_id)
            .execute()
        )
        exps = exps_res.data or []
        active_exps = [e for e in exps if e.get("status") in ("measuring", "running")]
        completed_exps = [e for e in exps if e.get("status") == "completed"]
        exp_indicator = FreshnessIndicator(
            last_updated=exps[0].get("updated_at") if exps else None,
            freshness_label=f"{len(active_exps)} active" if active_exps else "No active tests",
            is_fresh=bool(active_exps),
            details=f"{len(completed_exps)} completed closed-loop experiments",
        )

        # 5. Automation Health
        runs_res = (
            supabase.table("automation_runs")
            .select("status, completed_at, error_message")
            .eq("project_id", project_id)
            .order("created_at", desc=True)
            .limit(5)
            .execute()
        )
        recent_runs = runs_res.data or []
        failed_count = sum(1 for r in recent_runs if r.get("status") == "failed")
        auto_label, auto_fresh = _format_freshness(recent_runs[0].get("completed_at") if recent_runs else None)
        auto_indicator = FreshnessIndicator(
            last_updated=recent_runs[0].get("completed_at") if recent_runs else None,
            freshness_label=auto_label if recent_runs else "No runs yet",
            is_fresh=failed_count == 0 and bool(recent_runs),
            details=f"All {len(recent_runs)} recent jobs healthy" if failed_count == 0 else f"{failed_count} recent job errors detected",
        )

        # Count pending recs & unread notifs
        recs_count_res = supabase.table("recommendations").select("id").eq("project_id", project_id).eq("status", "pending").execute()
        pending_recs_count = len(recs_count_res.data or [])

        notifs_count_res = supabase.table("notifications").select("id").eq("project_id", project_id).eq("is_read", False).execute()
        unread_notifs_count = len(notifs_count_res.data or [])

        summary_status = "healthy"
        if failed_count > 0 or not gsc_conn:
            summary_status = "attention_needed"
        elif not seo_fresh or not geo_fresh:
            summary_status = "degraded"

        return ProjectHealthReport(
            project_id=project_id,
            project_name=project.get("name", ""),
            seo=seo_indicator,
            geo=geo_indicator,
            gsc=gsc_indicator,
            experiments=exp_indicator,
            automation=auto_indicator,
            summary_status=summary_status,
            active_experiments_count=len(active_exps),
            pending_recommendations_count=pending_recs_count,
            unread_notifications_count=unread_notifs_count,
        )

    # ── Notification Helper Methods ───────────────────────────────────────────

    @classmethod
    async def create_notification(
        cls,
        project_id: str,
        user_id: str,
        category: NotificationCategory,
        title: str,
        message: str,
        related_entity_id: Optional[str] = None,
        related_entity_type: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Inserts a notification record for the user."""
        supabase = get_supabase_admin()
        record = {
            "project_id": project_id,
            "user_id": user_id,
            "category": category,
            "title": title,
            "message": message,
            "is_read": False,
            "related_entity_id": related_entity_id,
            "related_entity_type": related_entity_type,
            "metadata": metadata or {},
        }
        res = supabase.table("notifications").insert(record).execute()
        return res.data[0] if res.data else record

    @classmethod
    async def dispatch_notification(
        cls,
        project_id: str,
        user_id: str,
        category: NotificationCategory,
        title: str,
        message: str,
        related_entity_id: Optional[str] = None,
        related_entity_type: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Optional[Dict[str, Any]]:
        """Dispatches a notification only if user preference permits it."""
        try:
            prefs = await cls.get_notification_preferences(project_id, user_id)
            if category == "report" and not prefs.get("weekly_reports", True):
                logger.info("Notification skipped per user preference: weekly_reports")
                return None
            elif category == "recommendation" and not prefs.get("high_priority_recs", True):
                logger.info("Notification skipped per user preference: high_priority_recs")
                return None
            elif category == "experiment" and not prefs.get("experiment_results", True):
                logger.info("Notification skipped per user preference: experiment_results")
                return None
            elif category == "geo_change" and not prefs.get("geo_visibility_changes", True):
                logger.info("Notification skipped per user preference: geo_visibility_changes")
                return None
            elif category == "system" and not prefs.get("automation_failures", True):
                logger.info("Notification skipped per user preference: automation_failures")
                return None
        except Exception as e:
            logger.warning("Failed to evaluate notification preferences: %s", e)

        return await cls.create_notification(
            project_id=project_id,
            user_id=user_id,
            category=category,
            title=title,
            message=message,
            related_entity_id=related_entity_id,
            related_entity_type=related_entity_type,
            metadata=metadata,
        )

    @classmethod
    async def list_notifications(cls, user_id: str, project_id: Optional[str] = None) -> List[Dict[str, Any]]:
        supabase = get_supabase_admin()
        query = supabase.table("notifications").select("*").eq("user_id", user_id)
        if project_id:
            query = query.eq("project_id", project_id)
        res = query.order("created_at", desc=True).limit(50).execute()
        return res.data or []

    @classmethod
    async def mark_notification_read(cls, notification_id: str, user_id: str) -> None:
        supabase = get_supabase_admin()
        supabase.table("notifications").update({"is_read": True}).eq("id", notification_id).eq("user_id", user_id).execute()

    @classmethod
    async def mark_all_notifications_read(cls, user_id: str, project_id: str) -> None:
        supabase = get_supabase_admin()
        supabase.table("notifications").update({"is_read": True}).eq("user_id", user_id).eq("project_id", project_id).execute()

    @classmethod
    async def get_notification_preferences(cls, project_id: str, user_id: str) -> Dict[str, Any]:
        supabase = get_supabase_admin()
        res = (
            supabase.table("notification_preferences")
            .select("*")
            .eq("project_id", project_id)
            .eq("user_id", user_id)
            .execute()
        )
        if res.data:
            return res.data[0]

        # Seed defaults
        default_pref = {
            "project_id": project_id,
            "user_id": user_id,
            "high_priority_recs": True,
            "experiment_results": True,
            "geo_visibility_changes": True,
            "weekly_reports": True,
            "automation_failures": True,
            "email_notifications_enabled": False,
            "email_recipient": None,
        }
        try:
            insert_res = supabase.table("notification_preferences").insert(default_pref).execute()
            return insert_res.data[0] if insert_res.data else default_pref
        except Exception:
            return default_pref

    @classmethod
    async def update_notification_preferences(
        cls,
        project_id: str,
        user_id: str,
        payload: NotificationPreferencesUpdate,
    ) -> Dict[str, Any]:
        supabase = get_supabase_admin()
        await cls.get_notification_preferences(project_id, user_id)

        update_dict: Dict[str, Any] = {"updated_at": datetime.now(timezone.utc).isoformat()}
        for k, v in payload.model_dump(exclude_unset=True).items():
            update_dict[k] = v

        res = (
            supabase.table("notification_preferences")
            .update(update_dict)
            .eq("project_id", project_id)
            .eq("user_id", user_id)
            .execute()
        )
        return res.data[0] if res.data else update_dict
