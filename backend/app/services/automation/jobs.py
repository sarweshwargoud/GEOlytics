"""Individual automation job implementations for GEOlytics.

Job 1: sync_search_console
Job 2: run_geo_visibility_checks
Job 3: run_seo_audit
Job 4: research_competitors
Job 5: run_intelligence_agent
Job 6: measure_active_experiments
Job 7: generate_project_report
"""

from datetime import datetime, timedelta, timezone
import logging
from typing import Any, Dict, List, Optional
import httpx

from app.core.database import get_supabase_admin
from app.services.agent.graph import run_intelligence_pipeline
from app.services.agent.hindsight import HindsightMemoryService
from app.services.crawl_runner import run_crawl_job
from app.services.experiments.service import ExperimentService
from app.services.geo.analyzer import GEOVisibilityAnalyzer
from app.services.geo.tavily_provider import TavilyResearchService
from app.services.gsc.service import GoogleSearchConsoleService

logger = logging.getLogger(__name__)


# ── Job 1: SEO Sync (Google Search Console) ───────────────────────────────────

async def job_sync_search_console(project_id: str, user_id: str) -> Dict[str, Any]:
    """Syncs Google Search Console performance data, deduplicating and handling reporting latency."""
    supabase = get_supabase_admin()

    conn_res = (
        supabase.table("search_console_connections")
        .select("*")
        .eq("project_id", project_id)
        .execute()
    )
    if not conn_res.data:
        return {
            "status": "skipped",
            "message": "Search Console is not connected for this project. Connect in SEO tab.",
            "synced_rows": 0,
        }

    conn = conn_res.data[0]
    site_url = conn.get("site_url")
    refresh_token = conn.get("refresh_token")

    if not site_url or not refresh_token:
        return {
            "status": "skipped",
            "message": "Incomplete GSC connection details.",
            "synced_rows": 0,
        }

    try:
        # Refresh access token
        token_data = await GoogleSearchConsoleService.refresh_access_token(refresh_token)
        access_token = token_data.get("access_token")

        if not access_token:
            raise ValueError("Failed to retrieve new access token from Google OAuth")

        # Sync past 28 days of search analytics
        synced_count = await GoogleSearchConsoleService.sync_performance_data(
            project_id=project_id,
            site_url=site_url,
            access_token=access_token,
            days=28,
        )

        return {
            "status": "completed",
            "message": f"Successfully synchronized {synced_count} search performance records from Google Search Console.",
            "synced_rows": synced_count,
            "latency_notice": "Google Search Console performance metrics carry a natural 48-72h reporting lag.",
        }
    except Exception as e:
        logger.error("GSC Sync failed for project %s: %s", project_id, e)
        return {
            "status": "failed",
            "message": f"Search Console sync encountered an error: {str(e)}",
            "error": str(e),
        }


# ── Job 2: GEO Visibility Check ───────────────────────────────────────────────

async def job_run_geo_visibility_checks(project_id: str, user_id: str) -> Dict[str, Any]:
    """Runs configured GEO queries across available AI search providers with failure isolation."""
    supabase = get_supabase_admin()

    proj_res = supabase.table("projects").select("website_url, name").eq("id", project_id).execute()
    if not proj_res.data:
        return {"status": "failed", "message": "Project not found"}
    project = proj_res.data[0]
    website_url = project.get("website_url", "")
    target_brand = project.get("name", "")

    # Fetch tracked queries
    queries_res = supabase.table("ai_search_queries").select("*").eq("project_id", project_id).eq("enabled", True).execute()
    queries = queries_res.data or []

    if not queries:
        return {
            "status": "skipped",
            "message": "No active tracked search queries found for this project.",
            "queries_checked": 0,
        }

    analyzer = GEOVisibilityAnalyzer()
    capabilities = analyzer.get_capabilities()
    active_providers = [c.provider for c in capabilities if c.configured]

    if not active_providers:
        return {
            "status": "skipped",
            "message": "No AI search providers (OpenAI, Gemini, Grok, Claude) are currently configured with API keys.",
            "queries_checked": 0,
        }

    total_checks = 0
    citations_observed = 0
    mentions_observed = 0
    provider_results: Dict[str, Dict[str, Any]] = {}
    provider_errors: List[str] = []

    # Run top queries (max 5 per automated run to respect rate limits)
    for q in queries[:5]:
        query_text = q["query"]
        for p in active_providers:
            if p not in provider_results:
                provider_results[p] = {"tested": 0, "cited": 0, "mentioned": 0}
            try:
                check_result = await analyzer.check_visibility(
                    project_id=project_id,
                    query_id=q["id"],
                    query_text=query_text,
                    target_domain=website_url,
                    target_brand=target_brand,
                    provider_name=p,
                )
                provider_results[p]["tested"] += 1
                total_checks += 1
                if check_result.get("website_cited"):
                    provider_results[p]["cited"] += 1
                    citations_observed += 1
                if check_result.get("brand_mentioned"):
                    provider_results[p]["mentioned"] += 1
                    mentions_observed += 1
            except Exception as e:
                logger.warning("GEO check failed on %s for query '%s': %s", p, query_text, e)
                provider_errors.append(f"{p}: {str(e)}")

    status = "completed" if not provider_errors else "partial_success"
    return {
        "status": status,
        "queries_checked": len(queries[:5]),
        "total_checks": total_checks,
        "citations_observed": citations_observed,
        "mentions_observed": mentions_observed,
        "provider_breakdown": provider_results,
        "provider_errors": provider_errors,
        "message": f"Completed {total_checks} AI visibility checks across {len(active_providers)} providers.",
    }


# ── Job 3: Website Audit (Crawler & SEO Analyzer) ──────────────────────────────

async def job_run_seo_audit(project_id: str, user_id: str, force: bool = False) -> Dict[str, Any]:
    """Runs website crawler and SEO audit if stale or forced."""
    supabase = get_supabase_admin()

    proj_res = supabase.table("projects").select("website_url").eq("id", project_id).execute()
    if not proj_res.data:
        return {"status": "failed", "message": "Project not found"}
    website_url = proj_res.data[0]["website_url"]

    # Check freshness of last crawl
    latest_crawl_res = (
        supabase.table("crawl_runs")
        .select("id, completed_at, status, seo_health_score")
        .eq("project_id", project_id)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    if latest_crawl_res.data and not force:
        latest = latest_crawl_res.data[0]
        completed_at_str = latest.get("completed_at")
        if completed_at_str:
            try:
                comp_dt = datetime.fromisoformat(completed_at_str.replace("Z", "+00:00"))
                hours_ago = (datetime.now(timezone.utc) - comp_dt).total_seconds() / 3600.0
                if hours_ago < 24.0:
                    return {
                        "status": "skipped",
                        "message": f"Website audit is fresh (completed {hours_ago:.1f} hours ago with health score {latest.get('seo_health_score')}). Crawl skipped.",
                        "crawl_run_id": latest.get("id"),
                        "hours_since_last_audit": round(hours_ago, 1),
                    }
            except Exception:
                pass

    try:
        crawl_insert = (
            supabase.table("crawl_runs")
            .insert(
                {
                    "project_id": project_id,
                    "status": "queued",
                }
            )
            .execute()
        )
        if not crawl_insert.data:
            return {"status": "failed", "message": "Failed to create crawl run record"}
        crawl_run_id = crawl_insert.data[0]["id"]

        await run_crawl_job(
            project_id=project_id,
            crawl_run_id=crawl_run_id,
            website_url=website_url,
            max_pages=25,
            max_depth=3,
        )

        # Fetch finalized run data
        final_res = supabase.table("crawl_runs").select("*").eq("id", crawl_run_id).execute()
        final_data = final_res.data[0] if final_res.data else {}

        return {
            "status": "completed",
            "message": f"Completed SEO audit crawl (Run ID: {crawl_run_id}). Health score calculated.",
            "crawl_run_id": crawl_run_id,
            "seo_health_score": final_data.get("seo_health_score"),
            "pages_crawled": final_data.get("pages_crawled", 0),
        }
    except Exception as e:
        logger.error("SEO Audit job failed for project %s: %s", project_id, e)
        return {"status": "failed", "message": f"SEO audit failed: {str(e)}", "error": str(e)}


# ── Job 4: Competitor Research (Tavily) ────────────────────────────────────────

async def job_research_competitors(project_id: str, user_id: str) -> Dict[str, Any]:
    """Researches competitor landscape on opportunity search queries using Tavily."""
    tavily = TavilyResearchService()
    if not tavily.is_configured():
        return {
            "status": "skipped",
            "message": "TAVILY_API_KEY is not configured on the server. Competitor research skipped.",
        }

    supabase = get_supabase_admin()
    proj_res = supabase.table("projects").select("website_url, name").eq("id", project_id).execute()
    if not proj_res.data:
        return {"status": "failed", "message": "Project not found"}
    project = proj_res.data[0]

    # Pick top opportunity queries
    queries_res = supabase.table("ai_search_queries").select("query").eq("project_id", project_id).limit(3).execute()
    queries = [q["query"] for q in (queries_res.data or [])]
    if not queries:
        queries = [f"top competitors in {project.get('name', 'industry')}"]

    research_summaries: List[Dict[str, Any]] = []
    for query in queries[:2]:
        try:
            res = await tavily.research_competitor_context(query=query)
            research_summaries.append({
                "query": query,
                "domains": res.get("identified_domains", []),
                "summary": res.get("summary", ""),
                "pages_found": res.get("competitor_pages_found", 0),
            })
        except Exception as e:
            logger.warning("Competitor research on '%s' failed: %s", query, e)

    return {
        "status": "completed" if research_summaries else "partial_success",
        "queries_researched": len(research_summaries),
        "research": research_summaries,
        "message": f"Researched {len(research_summaries)} competitor search topics via Tavily.",
    }


# ── Job 5: Agent Analysis (LangGraph) ──────────────────────────────────────────

async def job_run_intelligence_agent(project_id: str, user_id: str) -> Dict[str, Any]:
    """Invokes the LangGraph intelligence pipeline to generate evidence-backed recommendations."""
    try:
        agent_result = await run_intelligence_pipeline(project_id=project_id)
        recs = agent_result.get("recommendations", [])
        return {
            "status": "completed",
            "recommendations_generated": len(recs),
            "memories_recalled": agent_result.get("memories_recalled", 0),
            "execution_time_seconds": agent_result.get("execution_time_seconds", 0),
            "summary": agent_result.get("summary", "Generated recommendations."),
            "message": f"LangGraph pipeline generated {len(recs)} structured recommendations.",
        }
    except Exception as e:
        logger.error("LangGraph agent job failed for project %s: %s", project_id, e)
        return {"status": "failed", "message": f"Agent analysis failed: {str(e)}", "error": str(e)}


# ── Job 6: Experiment Measurement ─────────────────────────────────────────────

async def job_measure_active_experiments(project_id: str, user_id: str) -> Dict[str, Any]:
    """Measures all active experiments and auto-completes those whose measurement window has elapsed."""
    supabase = get_supabase_admin()
    exps_res = (
        supabase.table("experiments")
        .select("id, name, status, measurement_end, outcome")
        .eq("project_id", project_id)
        .in_("status", ["measuring", "running"])
        .execute()
    )
    active_exps = exps_res.data or []

    if not active_exps:
        return {
            "status": "skipped",
            "message": "No active experiments currently in the measurement window.",
            "measured_count": 0,
        }

    now = datetime.now(timezone.utc)
    measured_count = 0
    completed_count = 0
    details: List[Dict[str, Any]] = []

    for exp in active_exps:
        exp_id = exp["id"]
        try:
            measured = await ExperimentService.measure_experiment(exp_id, user_id)
            measured_count += 1
            is_completed = False

            # Check if measurement window has finished
            meas_end_str = exp.get("measurement_end")
            if meas_end_str:
                end_dt = datetime.fromisoformat(meas_end_str.replace("Z", "+00:00"))
                if now >= end_dt:
                    from app.schemas.experiments import CompleteExperimentRequest
                    comp = await ExperimentService.complete_experiment(
                        experiment_id=exp_id,
                        payload=CompleteExperimentRequest(),
                        user_id=user_id,
                    )
                    completed_count += 1
                    is_completed = True

            details.append({
                "id": exp_id,
                "name": exp["name"],
                "completed": is_completed,
                "outcome": measured.get("outcome", "pending"),
            })
        except Exception as e:
            logger.warning("Error measuring experiment %s: %s", exp_id, e)

    return {
        "status": "completed",
        "measured_count": measured_count,
        "completed_count": completed_count,
        "experiments": details,
        "message": f"Measured {measured_count} active experiments ({completed_count} completed measurement window).",
    }


# ── Job 7: Report Generation (Weekly Intelligence Summary) ────────────────────

async def job_generate_project_report(
    project_id: str,
    user_id: str,
    period_days: int = 7,
    report_type: str = "weekly",
) -> Dict[str, Any]:
    """Generates and persists a structured weekly intelligence report."""
    supabase = get_supabase_admin()
    now = datetime.now(timezone.utc)
    period_start = (now - timedelta(days=period_days)).strftime("%Y-%m-%d")
    period_end = now.strftime("%Y-%m-%d")

    # 1. Fetch Project
    proj_res = supabase.table("projects").select("*").eq("id", project_id).execute()
    if not proj_res.data:
        return {"status": "failed", "message": "Project not found"}
    project = proj_res.data[0]

    # 2. Gather SEO Performance
    seo_res = (
        supabase.table("search_performance")
        .select("clicks, impressions, ctr, position, date, query, page")
        .eq("project_id", project_id)
        .gte("date", period_start)
        .lte("date", period_end)
        .execute()
    )
    seo_rows = seo_res.data or []
    total_clicks = sum(r["clicks"] for r in seo_rows)
    total_impressions = sum(r["impressions"] for r in seo_rows)
    avg_ctr = round((total_clicks / max(1, total_impressions)) * 100.0, 2)
    avg_pos = round(sum(r["position"] for r in seo_rows) / max(1, len(seo_rows)), 1) if seo_rows else 0.0

    # 3. Gather GEO Visibility
    geo_res = (
        supabase.table("ai_visibility_checks")
        .select("provider, brand_mentioned, website_cited, created_at")
        .eq("project_id", project_id)
        .gte("created_at", f"{period_start}T00:00:00Z")
        .lte("created_at", f"{period_end}T23:59:59Z")
        .execute()
    )
    geo_checks = geo_res.data or []
    total_citations = sum(1 for c in geo_checks if c.get("website_cited"))
    total_mentions = sum(1 for c in geo_checks if c.get("brand_mentioned"))

    # 4. Gather Recommendations
    recs_res = (
        supabase.table("recommendations")
        .select("id, title, priority, status, type, action")
        .eq("project_id", project_id)
        .order("created_at", desc=True)
        .limit(10)
        .execute()
    )
    all_recs = recs_res.data or []
    pending_recs = [r for r in all_recs if r.get("status") == "pending"]
    high_priority_recs = [r for r in all_recs if r.get("priority") in ("critical", "high")]

    # 5. Gather Experiments
    exps_res = (
        supabase.table("experiments")
        .select("id, name, status, outcome, hypothesis, result")
        .eq("project_id", project_id)
        .execute()
    )
    all_exps = exps_res.data or []
    active_exps = [e for e in all_exps if e.get("status") in ("measuring", "running")]
    completed_exps = [e for e in all_exps if e.get("status") == "completed"]

    # 6. Gather Hindsight Learnings
    hindsight = HindsightMemoryService()
    memories = await hindsight.recall(project_id=project_id, query_context="strategy outcome learning", limit=5)
    memory_items = [
        {"title": m.title, "content": m.content, "type": m.memory_type, "category": m.category}
        for m in memories
    ]

    # Executive Summary Construction
    summary_parts = [
        f"Weekly Intelligence Report for {project.get('name')}:",
        f"• Organic Search: Recorded {total_clicks:,} clicks on {total_impressions:,} impressions (average CTR: {avg_ctr}%, avg position: {avg_pos})." if seo_rows else "• Search Console performance data pending sync.",
        f"• AI Search Visibility: {total_citations} source citations and {total_mentions} brand mentions observed across {len(geo_checks)} provider checks." if geo_checks else "• No AI visibility checks recorded this period.",
        f"• Action Pipeline: {len(pending_recs)} recommendations pending human review ({len(high_priority_recs)} high priority).",
        f"• Closed-Loop Experiments: {len(active_exps)} experiments actively measuring; {len(completed_exps)} completed with verified outcomes.",
    ]
    exec_summary = "\n".join(summary_parts)

    data_payload = {
        "executive_summary": exec_summary,
        "seo_performance": {
            "clicks": total_clicks,
            "impressions": total_impressions,
            "ctr": avg_ctr,
            "position": avg_pos,
            "has_data": bool(seo_rows),
        },
        "geo_visibility": {
            "checks_count": len(geo_checks),
            "citations_observed": total_citations,
            "mentions_observed": total_mentions,
            "has_data": bool(geo_checks),
        },
        "competitor_insights": {
            "summary": "Competitor content and comparison presence tracked via independent web grounding.",
        },
        "recommendations": {
            "total_count": len(all_recs),
            "pending_count": len(pending_recs),
            "high_priority_count": len(high_priority_recs),
            "items": all_recs[:5],
        },
        "experiments": {
            "active_count": len(active_exps),
            "completed_count": len(completed_exps),
            "items": all_exps[:5],
        },
        "hindsight_learnings": memory_items,
        "limitations": [
            "Search Console metrics carry a standard 48–72 hour data delay from Google.",
            "AI search groundings reflect observable point-in-time responses and are not guaranteed permanent rankings.",
            "External search algorithm updates and seasonality may influence cross-period metrics.",
        ],
        "data_freshness": {
            "generated_at": now.isoformat(),
            "period_start": period_start,
            "period_end": period_end,
            "gsc_latency": "48–72 hours",
        },
    }

    # Persist in reports table
    report_record = {
        "project_id": project_id,
        "report_type": report_type,
        "period_start": f"{period_start}T00:00:00Z",
        "period_end": f"{period_end}T23:59:59Z",
        "status": "completed",
        "summary": exec_summary,
        "data": data_payload,
        "created_at": now.isoformat(),
    }

    insert_res = supabase.table("reports").insert(report_record).execute()
    saved_report = insert_res.data[0] if insert_res.data else report_record

    return {
        "status": "completed",
        "report_id": saved_report.get("id"),
        "period": f"{period_start} to {period_end}",
        "summary": exec_summary,
        "report_data": data_payload,
        "message": f"Successfully generated {report_type} intelligence report.",
    }
