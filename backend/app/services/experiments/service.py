"""Closed-Loop SEO & GEO Experimentation Service.

Manages experiment lifecycles:
draft -> approved -> baseline_captured -> implementation_pending -> running -> measuring -> completed

Handles:
- Baseline capture from real GSC performance and GEO AI visibility checks
- Configurable measurement windows (7, 14, 28 days)
- Metric delta computation (absolute, percentage, pp for CTR, position improvement inversion)
- Success criteria evaluation and outcome classification (positive, neutral, negative, inconclusive, insufficient_data)
- Causality safeguards and confounding factor limitations
- Closed-loop Hindsight long-term memory persistence
"""

from datetime import datetime, timedelta, timezone
import logging
from typing import Any, Dict, List, Optional, Tuple
from fastapi import HTTPException, status

from app.core.database import get_supabase_admin
from app.schemas.experiments import (
    CompleteExperimentRequest,
    ExperimentCreate,
    ExperimentOutcome,
    ExperimentResult,
    ExperimentStatus,
    GEOMetricSnapshot,
    ImplementationConfirmRequest,
    MetricDeltaItem,
    PeriodSnapshot,
    SEOMetricSnapshot,
    SuccessCriterion,
)
from app.services.agent.hindsight import HindsightMemoryService
from app.services.agent.models import MemoryModel

logger = logging.getLogger(__name__)

# Standard confounding factors noted for SEO/GEO causality warnings
DEFAULT_LIMITATIONS = [
    "Observed change reflects correlation during the measurement window, not verified direct causality.",
    "External search engine algorithm updates during this window may have impacted ranking and impression distribution.",
    "Search volume seasonality and changing user search intent can naturally modulate impressions and CTR.",
    "Concurrent competitor content additions, updates, or link acquisitions may have affected relative visibility.",
    "Multiple simultaneous website modifications may have confounded single-variable attribution.",
]


class ExperimentService:
    """Core service for managing experiments, baseline capture, measurement, and outcome retention."""

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
    async def get_experiment(cls, experiment_id: str, user_id: str) -> Dict[str, Any]:
        """Retrieves an experiment by ID and verifies project ownership."""
        supabase = get_supabase_admin()
        res = (
            supabase.table("experiments")
            .select("*, projects(user_id)")
            .eq("id", experiment_id)
            .execute()
        )
        if not res.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Experiment not found",
            )
        exp = res.data[0]
        project = exp.get("projects") or {}
        if project.get("user_id") != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Unauthorized access to this experiment",
            )
        return exp

    @classmethod
    async def list_experiments(
        cls,
        project_id: str,
        user_id: str,
        status_filter: Optional[str] = None,
        outcome_filter: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Lists experiments for a project with optional status/outcome filtering."""
        cls._verify_project_ownership(project_id, user_id)
        supabase = get_supabase_admin()

        query = (
            supabase.table("experiments")
            .select("*")
            .eq("project_id", project_id)
        )
        if status_filter:
            query = query.eq("status", status_filter)
        if outcome_filter:
            query = query.eq("outcome", outcome_filter)

        res = query.order("created_at", desc=True).execute()
        return res.data or []

    @classmethod
    async def create_experiment(
        cls,
        project_id: str,
        payload: ExperimentCreate,
        user_id: str,
    ) -> Dict[str, Any]:
        """Creates a new experiment and captures its initial baseline."""
        cls._verify_project_ownership(project_id, user_id)
        supabase = get_supabase_admin()

        # Validate recommendation if linked
        if payload.recommendation_id:
            rec_res = (
                supabase.table("recommendations")
                .select("*")
                .eq("id", payload.recommendation_id)
                .eq("project_id", project_id)
                .execute()
            )
            if not rec_res.data:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Referenced recommendation does not belong to this project",
                )
            rec = rec_res.data[0]
            if rec.get("status") not in ("approved", "experiment_created", "pending"):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Cannot create experiment from recommendation in '{rec.get('status')}' status. Must be approved first.",
                )

        now = datetime.now(timezone.utc)
        baseline_start = (now - timedelta(days=payload.measurement_window_days)).strftime("%Y-%m-%d")
        baseline_end = now.strftime("%Y-%m-%d")

        # Capture initial baseline metrics
        baseline_period = await cls.capture_metrics(
            project_id=project_id,
            start_date=baseline_start,
            end_date=baseline_end,
            days=payload.measurement_window_days,
            affected_pages=payload.affected_pages,
            affected_queries=payload.affected_queries,
        )

        # Default success criteria if none provided
        success_criteria = [c.model_dump() for c in payload.success_criteria]
        if not success_criteria:
            success_criteria = [
                {
                    "metric": "ctr",
                    "target_type": "min_improvement",
                    "target_value": 5.0,
                    "description": "CTR improves by at least 5%",
                },
                {
                    "metric": "position",
                    "target_type": "improvement",
                    "target_value": 0.0,
                    "description": "Average ranking position improves",
                },
                {
                    "metric": "clicks",
                    "target_type": "no_drop",
                    "target_value": -5.0,
                    "description": "No significant drop in organic clicks",
                },
                {
                    "metric": "ai_citations",
                    "target_type": "increase",
                    "target_value": 1.0,
                    "description": "Increase in observed AI search citations",
                },
            ]

        experiment_data = {
            "project_id": project_id,
            "recommendation_id": payload.recommendation_id,
            "name": payload.name,
            "hypothesis": payload.hypothesis,
            "status": "baseline_captured",
            "start_date": now.isoformat(),
            "implementation_date": None,
            "measurement_start": None,
            "measurement_end": None,
            "baseline_period": baseline_period.model_dump(),
            "target_period": {},
            "success_criteria": success_criteria,
            "metrics": [
                {"name": "clicks", "unit": "count"},
                {"name": "impressions", "unit": "count"},
                {"name": "ctr", "unit": "%"},
                {"name": "position", "unit": "rank"},
                {"name": "ai_citations", "unit": "count"},
            ],
            "result": {},
            "outcome": "pending",
            "notes": payload.notes or "",
            "created_at": now.isoformat(),
            "updated_at": now.isoformat(),
        }

        insert_res = supabase.table("experiments").insert(experiment_data).execute()
        if not insert_res.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create experiment record",
            )
        created_exp = insert_res.data[0]

        # Update recommendation status to experiment_created
        if payload.recommendation_id:
            supabase.table("recommendations").update(
                {"status": "experiment_created", "updated_at": now.isoformat()}
            ).eq("id", payload.recommendation_id).execute()

        return created_exp

    @classmethod
    async def capture_baseline(cls, experiment_id: str, user_id: str) -> Dict[str, Any]:
        """Refreshes or re-captures the baseline for an existing experiment."""
        exp = await cls.get_experiment(experiment_id, user_id)
        project_id = exp["project_id"]
        baseline_period = exp.get("baseline_period") or {}
        days = baseline_period.get("days", 14)

        now = datetime.now(timezone.utc)
        baseline_start = (now - timedelta(days=days)).strftime("%Y-%m-%d")
        baseline_end = now.strftime("%Y-%m-%d")

        refreshed_baseline = await cls.capture_metrics(
            project_id=project_id,
            start_date=baseline_start,
            end_date=baseline_end,
            days=days,
        )

        supabase = get_supabase_admin()
        update_res = (
            supabase.table("experiments")
            .update({
                "baseline_period": refreshed_baseline.model_dump(),
                "status": "baseline_captured",
                "updated_at": now.isoformat(),
            })
            .eq("id", experiment_id)
            .execute()
        )
        return update_res.data[0] if update_res.data else exp

    @classmethod
    async def confirm_implementation(
        cls,
        experiment_id: str,
        payload: ImplementationConfirmRequest,
        user_id: str,
    ) -> Dict[str, Any]:
        """
        Confirms that the human has implemented the recommended changes on their website.
        Sets implementation_date, measurement_start, and measurement_end.
        Transitions experiment status to 'running' or 'measuring'.
        """
        exp = await cls.get_experiment(experiment_id, user_id)
        now = datetime.now(timezone.utc)

        impl_time = (
            datetime.fromisoformat(payload.implementation_date)
            if payload.implementation_date
            else now
        )
        baseline_period = exp.get("baseline_period") or {}
        days = baseline_period.get("days", 14)

        measurement_start = impl_time
        measurement_end = impl_time + timedelta(days=days)

        notes = exp.get("notes") or ""
        if payload.implementation_notes:
            notes = f"{notes}\n[Implementation {impl_time.strftime('%Y-%m-%d')}]: {payload.implementation_notes}".strip()

        supabase = get_supabase_admin()
        update_data = {
            "status": "measuring",
            "implementation_date": impl_time.isoformat(),
            "measurement_start": measurement_start.isoformat(),
            "measurement_end": measurement_end.isoformat(),
            "notes": notes,
            "updated_at": now.isoformat(),
        }

        res = supabase.table("experiments").update(update_data).eq("id", experiment_id).execute()
        updated_exp = res.data[0] if res.data else exp

        # If linked to recommendation, mark recommendation as measuring
        if exp.get("recommendation_id"):
            supabase.table("recommendations").update(
                {"status": "measuring", "updated_at": now.isoformat()}
            ).eq("id", exp["recommendation_id"]).execute()

        return updated_exp

    @classmethod
    async def measure_experiment(cls, experiment_id: str, user_id: str) -> Dict[str, Any]:
        """
        Collects post-implementation metrics, calculates deltas against baseline,
        evaluates against success criteria, and updates the experiment result.
        """
        exp = await cls.get_experiment(experiment_id, user_id)
        project_id = exp["project_id"]
        baseline_data = exp.get("baseline_period") or {}
        days = baseline_data.get("days", 14)

        now = datetime.now(timezone.utc)
        # Determine measurement window
        if exp.get("measurement_start"):
            try:
                meas_start_dt = datetime.fromisoformat(exp["measurement_start"].replace("Z", "+00:00"))
                target_start = meas_start_dt.strftime("%Y-%m-%d")
            except Exception:
                target_start = (now - timedelta(days=days)).strftime("%Y-%m-%d")
        else:
            target_start = (now - timedelta(days=days)).strftime("%Y-%m-%d")

        target_end = now.strftime("%Y-%m-%d")

        target_period = await cls.capture_metrics(
            project_id=project_id,
            start_date=target_start,
            end_date=target_end,
            days=days,
        )

        # Calculate before vs after deltas & evaluate
        result = cls.compute_before_after_analysis(
            baseline=baseline_data,
            target=target_period.model_dump(),
            success_criteria=exp.get("success_criteria") or [],
            experiment_name=exp.get("name", "Experiment"),
        )

        supabase = get_supabase_admin()
        update_data = {
            "target_period": target_period.model_dump(),
            "result": result.model_dump(),
            "outcome": result.outcome,
            "status": "measuring",
            "updated_at": now.isoformat(),
        }

        res = supabase.table("experiments").update(update_data).eq("id", experiment_id).execute()
        return res.data[0] if res.data else exp

    @classmethod
    async def complete_experiment(
        cls,
        experiment_id: str,
        payload: CompleteExperimentRequest,
        user_id: str,
    ) -> Dict[str, Any]:
        """
        Finalizes the experiment, classifies final outcome,
        creates a structured Hindsight long-term memory, and updates statuses.
        """
        # Run latest measurement first
        exp = await cls.measure_experiment(experiment_id, user_id)
        project_id = exp["project_id"]
        now = datetime.now(timezone.utc)

        result_data = exp.get("result") or {}
        final_outcome = payload.forced_outcome or result_data.get("outcome") or "inconclusive"

        notes = exp.get("notes") or ""
        if payload.final_notes:
            notes = f"{notes}\n[Completed {now.strftime('%Y-%m-%d')}]: {payload.final_notes}".strip()

        # Closed-loop learning: formulate structured Hindsight memory
        memory_title = f"Experiment Outcome: {exp.get('name')} ({final_outcome.upper()})"
        memory_content = cls._format_hindsight_learning(
            experiment=exp,
            outcome=final_outcome,
            result_data=result_data,
        )

        category = "geo" if "geo" in exp.get("name", "").lower() or "ai" in exp.get("name", "").lower() else "seo"
        confidence = 0.95 if final_outcome in ("positive", "negative") else 0.70

        hindsight_svc = HindsightMemoryService()
        memory_model = MemoryModel(
            project_id=project_id,
            memory_type="outcome",
            category=category,
            title=memory_title,
            content=memory_content,
            source="experiment_closed_loop",
            confidence=confidence,
            tags=["experiment", "closed_loop", final_outcome, category],
            metadata={
                "experiment_id": experiment_id,
                "recommendation_id": exp.get("recommendation_id"),
                "outcome": final_outcome,
                "deltas": result_data.get("deltas", {}),
            },
        )

        saved_mem = await hindsight_svc.retain(project_id=project_id, memory=memory_model)
        result_data["hindsight_memory_retained"] = saved_mem.id or "retained"
        result_data["outcome"] = final_outcome

        supabase = get_supabase_admin()
        update_data = {
            "status": "completed",
            "outcome": final_outcome,
            "result": result_data,
            "notes": notes,
            "completed_at": now.isoformat(),
            "updated_at": now.isoformat(),
        }

        res = supabase.table("experiments").update(update_data).eq("id", experiment_id).execute()
        completed_exp = res.data[0] if res.data else exp

        # If recommendation linked, mark recommendation as completed
        if exp.get("recommendation_id"):
            supabase.table("recommendations").update(
                {"status": "completed", "updated_at": now.isoformat()}
            ).eq("id", exp["recommendation_id"]).execute()

        return completed_exp

    @classmethod
    async def capture_metrics(
        cls,
        project_id: str,
        start_date: str,
        end_date: str,
        days: int = 14,
        affected_pages: Optional[List[str]] = None,
        affected_queries: Optional[List[str]] = None,
    ) -> PeriodSnapshot:
        """Pulls real metrics from GSC performance and GEO AI visibility checks within date range."""
        supabase = get_supabase_admin()

        # 1. Collect GSC data
        seo_snapshot = SEOMetricSnapshot(start_date=start_date, end_date=end_date)
        try:
            gsc_query = (
                supabase.table("search_performance")
                .select("clicks, impressions, ctr, position, page, query, date")
                .eq("project_id", project_id)
                .gte("date", start_date)
                .lte("date", end_date)
            )
            gsc_res = gsc_query.execute()
            rows = gsc_res.data or []

            if affected_pages:
                rows = [r for r in rows if any(p in r.get("page", "") for p in affected_pages)]
            if affected_queries:
                rows = [r for r in rows if any(q.lower() in r.get("query", "").lower() for q in affected_queries)]

            if rows:
                total_clicks = sum(r["clicks"] for r in rows)
                total_impressions = sum(r["impressions"] for r in rows)
                avg_ctr = round((total_clicks / max(1, total_impressions)) * 100.0, 2)
                avg_pos = round(sum(r["position"] for r in rows) / len(rows), 1)

                seo_snapshot = SEOMetricSnapshot(
                    clicks=total_clicks,
                    impressions=total_impressions,
                    ctr=avg_ctr,
                    position=avg_pos,
                    start_date=start_date,
                    end_date=end_date,
                    available=True,
                )
            else:
                seo_snapshot.available = False
        except Exception as e:
            logger.warning("Error fetching GSC metrics for experiment: %s", e)
            seo_snapshot.available = False

        # 2. Collect GEO data
        geo_snapshot = GEOMetricSnapshot()
        try:
            geo_query = (
                supabase.table("ai_visibility_checks")
                .select("id, query_id, provider, brand_mentioned, website_cited, competitor_domains, created_at, ai_search_queries(query)")
                .eq("project_id", project_id)
                .gte("created_at", f"{start_date}T00:00:00Z")
                .lte("created_at", f"{end_date}T23:59:59Z")
            )
            geo_res = geo_query.execute()
            checks = geo_res.data or []

            if checks:
                total_citations = sum(1 for c in checks if c.get("website_cited"))
                total_mentions = sum(1 for c in checks if c.get("brand_mentioned"))

                provider_breakdown: Dict[str, Dict[str, Any]] = {}
                query_details_map: Dict[str, Dict[str, Any]] = {}

                for c in checks:
                    p = c.get("provider", "unknown")
                    if p not in provider_breakdown:
                        provider_breakdown[p] = {"citations": 0, "mentions": 0, "total_checks": 0}
                    provider_breakdown[p]["total_checks"] += 1
                    if c.get("website_cited"):
                        provider_breakdown[p]["citations"] += 1
                    if c.get("brand_mentioned"):
                        provider_breakdown[p]["mentions"] += 1

                    q_data = c.get("ai_search_queries") or {}
                    q_text = q_data.get("query") if isinstance(q_data, dict) else str(c.get("query_id"))
                    if q_text not in query_details_map:
                        query_details_map[q_text] = {
                            "query": q_text,
                            "cited": False,
                            "mentioned": False,
                            "providers": [],
                            "competitor_presence": [],
                        }
                    if c.get("website_cited"):
                        query_details_map[q_text]["cited"] = True
                    if c.get("brand_mentioned"):
                        query_details_map[q_text]["mentioned"] = True
                    query_details_map[q_text]["providers"].append(p)
                    for comp in c.get("competitor_domains", []):
                        if comp and comp not in query_details_map[q_text]["competitor_presence"]:
                            query_details_map[q_text]["competitor_presence"].append(comp)

                geo_snapshot = GEOMetricSnapshot(
                    observed_citations=total_citations,
                    observed_mentions=total_mentions,
                    tested_queries_count=len(query_details_map),
                    provider_breakdown=provider_breakdown,
                    query_details=list(query_details_map.values()),
                    available=True,
                )
            else:
                geo_snapshot.available = False
        except Exception as e:
            logger.warning("Error fetching GEO metrics for experiment: %s", e)
            geo_snapshot.available = False

        return PeriodSnapshot(
            start_date=start_date,
            end_date=end_date,
            days=days,
            seo=seo_snapshot,
            geo=geo_snapshot,
        )

    @classmethod
    def compute_before_after_analysis(
        cls,
        baseline: Dict[str, Any],
        target: Dict[str, Any],
        success_criteria: List[Dict[str, Any]],
        experiment_name: str,
    ) -> ExperimentResult:
        """
        Computes accurate deltas between baseline and target periods.
        - Absolute, percentage, and percentage-point deltas
        - Position improvement calculation (lower numerical position = better)
        - Criteria evaluation
        - Cautious outcome classification with causality safeguards
        """
        baseline_seo = baseline.get("seo") or {}
        target_seo = target.get("seo") or {}
        baseline_geo = baseline.get("geo") or {}
        target_geo = target.get("geo") or {}

        metric_items: List[MetricDeltaItem] = []
        deltas: Dict[str, Any] = {"seo": {}, "geo": {}}
        evidence: List[str] = []

        # ── 1. SEO Metric: Clicks ─────────────────────────────────────────────
        b_clicks = baseline_seo.get("clicks", 0)
        t_clicks = target_seo.get("clicks", 0)
        abs_clicks = t_clicks - b_clicks
        pct_clicks = round(((t_clicks - b_clicks) / max(1, b_clicks)) * 100.0, 1) if b_clicks > 0 else 0.0
        click_status = "improved" if abs_clicks > 0 else ("regressed" if abs_clicks < 0 else "neutral")
        if not baseline_seo.get("available") and not target_seo.get("available"):
            click_status = "no_data"

        deltas["seo"]["clicks"] = {
            "baseline": b_clicks,
            "after": t_clicks,
            "absolute_delta": abs_clicks,
            "percent_delta": pct_clicks,
            "status": click_status,
        }
        metric_items.append(
            MetricDeltaItem(
                metric="clicks",
                baseline=float(b_clicks),
                after=float(t_clicks),
                absolute_delta=float(abs_clicks),
                percent_delta=pct_clicks,
                status=click_status,
                formatted_display=f"{'+' if abs_clicks > 0 else ''}{abs_clicks} ({'+' if pct_clicks > 0 else ''}{pct_clicks}%)",
            )
        )
        if baseline_seo.get("available") and target_seo.get("available"):
            evidence.append(f"Clicks changed from {b_clicks} to {t_clicks} ({'+' if pct_clicks > 0 else ''}{pct_clicks}%).")

        # ── 2. SEO Metric: Impressions ────────────────────────────────────────
        b_imp = baseline_seo.get("impressions", 0)
        t_imp = target_seo.get("impressions", 0)
        abs_imp = t_imp - b_imp
        pct_imp = round(((t_imp - b_imp) / max(1, b_imp)) * 100.0, 1) if b_imp > 0 else 0.0
        imp_status = "improved" if abs_imp > 0 else ("regressed" if abs_imp < 0 else "neutral")
        if not baseline_seo.get("available") and not target_seo.get("available"):
            imp_status = "no_data"

        deltas["seo"]["impressions"] = {
            "baseline": b_imp,
            "after": t_imp,
            "absolute_delta": abs_imp,
            "percent_delta": pct_imp,
            "status": imp_status,
        }
        metric_items.append(
            MetricDeltaItem(
                metric="impressions",
                baseline=float(b_imp),
                after=float(t_imp),
                absolute_delta=float(abs_imp),
                percent_delta=pct_imp,
                status=imp_status,
                formatted_display=f"{'+' if abs_imp > 0 else ''}{abs_imp} ({'+' if pct_imp > 0 else ''}{pct_imp}%)",
            )
        )
        if baseline_seo.get("available") and target_seo.get("available"):
            evidence.append(f"Impressions changed from {b_imp} to {t_imp} ({'+' if pct_imp > 0 else ''}{pct_imp}%).")

        # ── 3. SEO Metric: CTR (Percentage Point Delta) ────────────────────────
        b_ctr = baseline_seo.get("ctr", 0.0)
        t_ctr = target_seo.get("ctr", 0.0)
        pp_ctr = round(t_ctr - b_ctr, 2)
        pct_ctr = round(((t_ctr - b_ctr) / max(0.01, b_ctr)) * 100.0, 1) if b_ctr > 0 else 0.0
        ctr_status = "improved" if pp_ctr > 0.1 else ("regressed" if pp_ctr < -0.1 else "neutral")
        if not baseline_seo.get("available") and not target_seo.get("available"):
            ctr_status = "no_data"

        deltas["seo"]["ctr"] = {
            "baseline": b_ctr,
            "after": t_ctr,
            "absolute_delta": pp_ctr,
            "pp_delta": pp_ctr,
            "percent_delta": pct_ctr,
            "status": ctr_status,
        }
        metric_items.append(
            MetricDeltaItem(
                metric="ctr",
                baseline=float(b_ctr),
                after=float(t_ctr),
                absolute_delta=pp_ctr,
                pp_delta=pp_ctr,
                percent_delta=pct_ctr,
                status=ctr_status,
                formatted_display=f"{'+' if pp_ctr > 0 else ''}{pp_ctr}pp ({'+' if pct_ctr > 0 else ''}{pct_ctr}%)",
            )
        )
        if baseline_seo.get("available") and target_seo.get("available"):
            evidence.append(f"Organic CTR shifted from {b_ctr}% to {t_ctr}% ({'+' if pp_ctr > 0 else ''}{pp_ctr} percentage points).")

        # ── 4. SEO Metric: Position (Lower is Better!) ────────────────────────
        b_pos = baseline_seo.get("position", 0.0)
        t_pos = target_seo.get("position", 0.0)
        pos_improvement = round(b_pos - t_pos, 1) if (b_pos > 0 and t_pos > 0) else 0.0
        pos_status = "improved" if pos_improvement > 0.2 else ("regressed" if pos_improvement < -0.2 else "neutral")
        if b_pos == 0.0 or t_pos == 0.0 or (not baseline_seo.get("available") and not target_seo.get("available")):
            pos_status = "no_data"

        deltas["seo"]["position"] = {
            "baseline": b_pos,
            "after": t_pos,
            "absolute_delta": round(t_pos - b_pos, 1),
            "position_improvement": pos_improvement,
            "status": pos_status,
        }
        metric_items.append(
            MetricDeltaItem(
                metric="position",
                baseline=float(b_pos),
                after=float(t_pos),
                absolute_delta=round(t_pos - b_pos, 1),
                position_improvement=pos_improvement,
                status=pos_status,
                formatted_display=f"{'+' if pos_improvement > 0 else ''}{pos_improvement} positions (from {b_pos} to {t_pos})",
            )
        )
        if b_pos > 0 and t_pos > 0:
            evidence.append(f"Average rank position moved from {b_pos} to {t_pos} ({'+' if pos_improvement > 0 else ''}{pos_improvement} positions).")

        # ── 5. GEO Metric: Observed AI Citations ──────────────────────────────
        b_cit = baseline_geo.get("observed_citations", 0)
        t_cit = target_geo.get("observed_citations", 0)
        abs_cit = t_cit - b_cit
        cit_status = "improved" if abs_cit > 0 else ("regressed" if abs_cit < 0 else "neutral")
        if not baseline_geo.get("available") and not target_geo.get("available"):
            cit_status = "no_data"

        deltas["geo"]["citations"] = {
            "baseline": b_cit,
            "after": t_cit,
            "absolute_delta": abs_cit,
            "status": cit_status,
        }
        metric_items.append(
            MetricDeltaItem(
                metric="ai_citations",
                baseline=float(b_cit),
                after=float(t_cit),
                absolute_delta=float(abs_cit),
                status=cit_status,
                formatted_display=f"{'+' if abs_cit > 0 else ''}{abs_cit} citations (from {b_cit} to {t_cit})",
            )
        )
        if baseline_geo.get("available") or target_geo.get("available"):
            evidence.append(f"Observed AI search citations changed from {b_cit} to {t_cit} across tracked queries.")

        # ── 6. Evaluate Success Criteria ─────────────────────────────────────
        criteria_evals: List[Dict[str, Any]] = []
        met_count = 0
        failed_count = 0

        for crit in success_criteria:
            metric_key = crit.get("metric", "")
            target_type = crit.get("target_type", "")
            target_val = float(crit.get("target_value", 0.0))
            passed = False
            explanation = ""

            if metric_key == "ctr":
                if target_type == "min_improvement":
                    passed = pct_ctr >= target_val
                    explanation = f"CTR change was {pct_ctr}% (target >= {target_val}%)"
                elif target_type == "positive_delta":
                    passed = pp_ctr > 0
                    explanation = f"CTR pp delta was {pp_ctr}pp"
                else:
                    passed = pp_ctr >= target_val
                    explanation = f"CTR delta was {pp_ctr}pp (target >= {target_val})"
            elif metric_key == "position":
                passed = pos_improvement >= target_val
                explanation = f"Position improvement was {pos_improvement} positions (target >= {target_val})"
            elif metric_key == "clicks":
                if target_type == "no_drop":
                    passed = pct_clicks >= target_val
                    explanation = f"Clicks percentage change was {pct_clicks}% (limit >= {target_val}%)"
                else:
                    passed = abs_clicks >= target_val
                    explanation = f"Clicks absolute change was {abs_clicks}"
            elif metric_key in ("ai_citations", "citations"):
                passed = abs_cit >= target_val
                explanation = f"Observed AI citations delta was {abs_cit} (target >= {target_val})"
            elif metric_key == "impressions":
                passed = abs_imp >= target_val
                explanation = f"Impressions delta was {abs_imp}"
            else:
                passed = True
                explanation = "Standard observation threshold met"

            if passed:
                met_count += 1
            else:
                failed_count += 1

            criteria_evals.append({
                "criterion": crit.get("description") or f"{metric_key} {target_type}",
                "metric": metric_key,
                "passed": passed,
                "detail": explanation,
            })

        # ── 7. Outcome Classification ─────────────────────────────────────────
        has_seo_data = bool(baseline_seo.get("available") or target_seo.get("available"))
        has_geo_data = bool(baseline_geo.get("available") or target_geo.get("available"))

        if not has_seo_data and not has_geo_data:
            outcome: ExperimentOutcome = "insufficient_data"
            summary = "No Search Console performance or AI visibility check data was recorded during the evaluation window."
        elif has_seo_data and b_imp < 15 and t_imp < 15 and not has_geo_data:
            outcome = "insufficient_data"
            summary = "Observed impression volume (<15 impressions) is too low to establish a statistically reliable trend."
        elif met_count > 0 and failed_count == 0:
            outcome = "positive"
            summary = f"All {met_count} defined success criteria were satisfied during the measurement window."
        elif met_count > 0 and failed_count > 0:
            if click_status == "regressed" and abs_clicks < -10:
                outcome = "negative"
                summary = "Primary traffic metrics regressed despite isolated positive secondary signals."
            elif met_count >= failed_count and (pct_ctr > 5.0 or abs_cit > 0 or pos_improvement > 1.0):
                outcome = "positive"
                summary = "Primary target criteria were satisfied with minor neutral secondary signals."
            else:
                outcome = "inconclusive"
                summary = "Observed metrics showed conflicting trends across search metrics."
        elif met_count == 0 and failed_count > 0:
            if click_status == "regressed" or pos_status == "regressed":
                outcome = "negative"
                summary = "Observed metrics regressed contrary to the hypothesis during the measurement window."
            else:
                outcome = "neutral"
                summary = "No statistically meaningful difference observed across target metrics during the test window."
        else:
            outcome = "inconclusive"
            summary = "Evidence was inconclusive across the measurement timeframe."

        return ExperimentResult(
            deltas=deltas,
            metric_items=metric_items,
            criteria_evaluations=criteria_evals,
            outcome=outcome,
            outcome_summary=summary,
            evidence=evidence,
            limitations=DEFAULT_LIMITATIONS,
        )

    @classmethod
    def _format_hindsight_learning(
        cls,
        experiment: Dict[str, Any],
        outcome: str,
        result_data: Dict[str, Any],
    ) -> str:
        """Creates a standardized, factual summary of the experiment for Hindsight memory."""
        name = experiment.get("name", "SEO/GEO Experiment")
        hypothesis = experiment.get("hypothesis", "")
        deltas = result_data.get("deltas") or {}
        seo_deltas = deltas.get("seo") or {}
        geo_deltas = deltas.get("geo") or {}

        lines = [
            f"Strategy Tested: {name}",
            f"Hypothesis: {hypothesis}",
            f"Observed Outcome: {outcome.upper()}",
        ]

        # SEO metrics
        if seo_deltas:
            clicks = seo_deltas.get("clicks", {})
            ctr = seo_deltas.get("ctr", {})
            pos = seo_deltas.get("position", {})
            lines.append(
                f"SEO Observations: Clicks {clicks.get('baseline', 0)} -> {clicks.get('after', 0)} ({clicks.get('percent_delta', 0)}%), "
                f"CTR {ctr.get('baseline', 0)}% -> {ctr.get('after', 0)}% ({ctr.get('pp_delta', 0)}pp), "
                f"Position {pos.get('baseline', 0)} -> {pos.get('after', 0)} ({pos.get('position_improvement', 0)} positions)."
            )

        # GEO metrics
        if geo_deltas:
            cits = geo_deltas.get("citations", {})
            lines.append(
                f"GEO Observations: Observed AI citations {cits.get('baseline', 0)} -> {cits.get('after', 0)} "
                f"({'+' if cits.get('absolute_delta', 0) > 0 else ''}{cits.get('absolute_delta', 0)})."
            )

        # Learning takeaway
        if outcome == "positive":
            lines.append(
                f"Takeaway: This strategy was associated with positive performance metrics during the measurement period. "
                "Consider applying similar techniques to comparable target pages, noting site context."
            )
        elif outcome == "neutral":
            lines.append(
                "Takeaway: This change produced no meaningful improvement during the measurement period. "
                "Do not prioritize similar standalone changes without additional unique content value."
            )
        elif outcome == "negative":
            lines.append(
                "Takeaway: Observed performance metrics declined following this implementation. "
                "Review the change for unintended technical or relevancy regressions."
            )
        elif outcome == "insufficient_data":
            lines.append(
                "Takeaway: Insufficient search volume or observation window. "
                "Extend measurement duration before drawing conclusions."
            )
        else:
            lines.append(
                "Takeaway: Inconclusive data. External factors or conflicting metrics prevent definitive attribution."
            )

        lines.append(
            "Causality Caution: Observed performance correlates with the post-implementation window; "
            "independent external variables (seasonality, competitor moves, algorithm updates) may have contributed."
        )

        return "\n".join(lines)
