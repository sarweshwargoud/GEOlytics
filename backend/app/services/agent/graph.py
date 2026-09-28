"""LangGraph State Graph orchestrating SEO + GEO recommendation intelligence.

Architecture:
START
  ↓
collect_data
  ↓
analyze_seo
  ↓
analyze_geo
  ↓
research_competitors (Tavily)
  ↓
recall_memory (Hindsight)
  ↓
reason
  ↓
generate_recommendation
  ↓
validate_recommendation
  ↓
save_recommendation
  ↓
END
"""

import asyncio
from datetime import datetime
import logging
from typing import Any, Dict, List, Optional
from langgraph.graph import StateGraph, START, END

from app.core.database import get_supabase_admin
from app.services.agent.hindsight import HindsightMemoryService
from app.services.agent.models import (
    LangGraphAgentState,
    MemoryModel,
    RecommendationModel,
)
from app.services.crawler.url_utils import get_base_domain
from app.services.geo.tavily_provider import TavilyResearchService

logger = logging.getLogger(__name__)


# ── Node 1: Collect Data ──────────────────────────────────────────────────────

async def collect_data_node(state: LangGraphAgentState) -> Dict[str, Any]:
    """Collects existing SEO audit, GSC analytics, and AI search visibility data from Supabase."""
    project_id = state["project_id"]
    supabase = get_supabase_admin()
    log = state.get("execution_log", [])
    log.append("collect_data: Gathering crawl, GSC, and GEO visibility records from Supabase.")

    collected_seo: Dict[str, Any] = {
        "latest_crawl": None,
        "issues": [],
        "pages": [],
        "gsc_performance": [],
    }
    collected_geo: Dict[str, Any] = {
        "tracked_queries": [],
        "latest_checks": [],
        "citations": [],
    }

    try:
        # 1. Fetch latest crawl run
        crawl_res = (
            supabase.table("crawl_runs")
            .select("*")
            .eq("project_id", project_id)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        if crawl_res.data:
            latest_crawl = crawl_res.data[0]
            collected_seo["latest_crawl"] = latest_crawl

            # Fetch issues and sample pages from this crawl
            issues_res = (
                supabase.table("seo_issues")
                .select("*")
                .eq("crawl_run_id", latest_crawl["id"])
                .limit(50)
                .execute()
            )
            collected_seo["issues"] = issues_res.data or []

            pages_res = (
                supabase.table("crawl_pages")
                .select("url, status_code, title, meta_description, h1, word_count, schema_data")
                .eq("crawl_run_id", latest_crawl["id"])
                .limit(30)
                .execute()
            )
            collected_seo["pages"] = pages_res.data or []

        # 2. Fetch GSC performance rows
        gsc_res = (
            supabase.table("search_performance")
            .select("query, page, clicks, impressions, ctr, position, date")
            .eq("project_id", project_id)
            .order("clicks", desc=True)
            .limit(40)
            .execute()
        )
        collected_seo["gsc_performance"] = gsc_res.data or []

        # 3. Fetch GEO tracked queries and visibility checks
        queries_res = (
            supabase.table("ai_search_queries")
            .select("*")
            .eq("project_id", project_id)
            .execute()
        )
        collected_geo["tracked_queries"] = queries_res.data or []

        checks_res = (
            supabase.table("ai_visibility_checks")
            .select("id, query_id, provider, model, brand_mentioned, website_cited, competitor_domains, sources, created_at")
            .eq("project_id", project_id)
            .order("created_at", desc=True)
            .limit(30)
            .execute()
        )
        collected_geo["latest_checks"] = checks_res.data or []

        citations_res = (
            supabase.table("ai_citations")
            .select("url, domain, is_own_domain, is_competitor, citation_order")
            .limit(50)
            .execute()
        )
        collected_geo["citations"] = citations_res.data or []

    except Exception as e:
        logger.error("Error collecting data in collect_data_node: %s", e)
        state.setdefault("errors", []).append(f"collect_data_error: {str(e)}")

    return {
        "collected_seo": collected_seo,
        "collected_geo": collected_geo,
        "execution_log": log,
    }


# ── Node 2: Analyze SEO ───────────────────────────────────────────────────────

async def analyze_seo_node(state: LangGraphAgentState) -> Dict[str, Any]:
    """Analyzes technical, on-page, and Search Console performance opportunities."""
    log = state.get("execution_log", [])
    log.append("analyze_seo: Diagnosing SEO health, high-impression low-CTR queries, and metadata gaps.")

    collected_seo = state.get("collected_seo", {})
    issues = collected_seo.get("issues", [])
    pages = collected_seo.get("pages", [])
    gsc_rows = collected_seo.get("gsc_performance", [])

    seo_analysis: Dict[str, Any] = {
        "critical_issues": [i for i in issues if i.get("severity") in ("critical", "high")],
        "low_ctr_opportunities": [],
        "missing_schema_pages": [],
        "thin_content_pages": [],
        "meta_gaps": [],
    }

    # Identify high impression low CTR queries (opportunities)
    for row in gsc_rows:
        impressions = row.get("impressions", 0)
        ctr = row.get("ctr", 0.0)
        pos = row.get("position", 99.0)
        if impressions >= 20 and ctr < 3.0 and pos <= 20.0:
            seo_analysis["low_ctr_opportunities"].append({
                "query": row.get("query"),
                "page": row.get("page"),
                "impressions": impressions,
                "clicks": row.get("clicks", 0),
                "ctr": ctr,
                "position": pos,
            })

    # Identify page-level opportunities
    for p in pages:
        url = p.get("url", "")
        if not p.get("title") or len(p.get("title", "")) < 15:
            seo_analysis["meta_gaps"].append({"url": url, "issue": "Missing or short title tag"})
        if not p.get("meta_description") or len(p.get("meta_description", "")) < 30:
            seo_analysis["meta_gaps"].append({"url": url, "issue": "Missing or short meta description"})
        if p.get("word_count", 0) < 250:
            seo_analysis["thin_content_pages"].append({"url": url, "word_count": p.get("word_count", 0)})
        schema_data = p.get("schema_data") or []
        if not schema_data or len(schema_data) == 0:
            seo_analysis["missing_schema_pages"].append(url)

    return {
        "seo_analysis": seo_analysis,
        "execution_log": log,
    }


# ── Node 3: Analyze GEO ───────────────────────────────────────────────────────

async def analyze_geo_node(state: LangGraphAgentState) -> Dict[str, Any]:
    """Analyzes observable AI answer visibility, mentions vs citations, and competitor dominance."""
    log = state.get("execution_log", [])
    log.append("analyze_geo: Analyzing observable AI search citations and competitor mentions.")

    collected_geo = state.get("collected_geo", {})
    queries = collected_geo.get("tracked_queries", [])
    checks = collected_geo.get("latest_checks", [])

    geo_analysis: Dict[str, Any] = {
        "queries_with_citations": [],
        "queries_missing_citations": [],
        "queries_where_competitors_cited": [],
        "frequently_cited_competitor_domains": [],
        "provider_discrepancies": [],
    }

    competitor_tally: Dict[str, int] = {}

    for q in queries:
        qid = q.get("id")
        q_text = q.get("query", "")
        q_checks = [c for c in checks if c.get("query_id") == qid]

        if not q_checks:
            continue

        cited_any = any(c.get("website_cited", False) for c in q_checks)
        mentioned_any = any(c.get("brand_mentioned", False) for c in q_checks)

        if cited_any:
            geo_analysis["queries_with_citations"].append({"query": q_text, "providers": [c.get("provider") for c in q_checks if c.get("website_cited")]})
        else:
            geo_analysis["queries_missing_citations"].append({
                "query": q_text,
                "brand_mentioned": mentioned_any,
                "tested_providers": [c.get("provider") for c in q_checks],
            })

        for c in q_checks:
            for comp in c.get("competitor_domains", []):
                competitor_tally[comp] = competitor_tally.get(comp, 0) + 1
                if comp and q_text not in [x["query"] for x in geo_analysis["queries_where_competitors_cited"]]:
                    geo_analysis["queries_where_competitors_cited"].append({
                        "query": q_text,
                        "competitor": comp,
                        "provider": c.get("provider"),
                    })

    # Sort competitor tally
    sorted_comps = sorted(competitor_tally.items(), key=lambda x: x[1], reverse=True)
    geo_analysis["frequently_cited_competitor_domains"] = [c[0] for c in sorted_comps[:5]]

    return {
        "geo_analysis": geo_analysis,
        "execution_log": log,
    }


# ── Node 4: Research Competitors (Tavily) ──────────────────────────────────────

async def research_competitors_node(state: LangGraphAgentState) -> Dict[str, Any]:
    """Uses Tavily to research public competitor pages for key opportunity queries."""
    log = state.get("execution_log", [])
    log.append("research_competitors: Gathering independent web research on top opportunity queries.")

    geo_analysis = state.get("geo_analysis", {})
    seo_analysis = state.get("seo_analysis", {})
    tavily = TavilyResearchService()

    competitor_research: List[Dict[str, Any]] = []

    # Pick top opportunity queries to research
    queries_to_research: List[str] = []

    # 1. From GEO queries where competitors are cited
    for item in geo_analysis.get("queries_where_competitors_cited", [])[:2]:
        q = item.get("query")
        if q and q not in queries_to_research:
            queries_to_research.append(q)

    # 2. From SEO low CTR opportunities
    for item in seo_analysis.get("low_ctr_opportunities", [])[:2]:
        q = item.get("query")
        if q and q not in queries_to_research:
            queries_to_research.append(q)

    # Fallback to general brand domain query if none tracked
    if not queries_to_research and state.get("website_url"):
        queries_to_research.append(f"top competitors in {get_base_domain(state['website_url'])}")

    for query in queries_to_research[:2]:
        try:
            res = await tavily.research_competitor_context(
                query=query,
                competitor_domains=geo_analysis.get("frequently_cited_competitor_domains", []),
            )
            competitor_research.append({
                "query": query,
                "identified_domains": res.get("identified_domains", []),
                "top_results_sample": [
                    {"title": r.get("title"), "url": r.get("url")}
                    for r in res.get("direct_results", [])[:3]
                ],
                "summary": res.get("summary", ""),
            })
        except Exception as e:
            logger.warning("Tavily research failed for '%s': %s", query, e)

    return {
        "competitor_research": competitor_research,
        "execution_log": log,
    }


# ── Node 5: Recall Memory (Hindsight) ──────────────────────────────────────────

async def recall_memory_node(state: LangGraphAgentState) -> Dict[str, Any]:
    """Queries Hindsight for historical experiences, previous strategies, and user preferences."""
    log = state.get("execution_log", [])
    log.append("recall_memory: Recalling relevant lessons, past outcomes, and user preferences from Hindsight.")

    project_id = state["project_id"]
    hindsight = HindsightMemoryService()

    recalled_memories: List[Dict[str, Any]] = []
    seen_ids = set()

    # 1. Directly query closed-loop experiment outcomes for this project
    try:
        supabase = get_supabase_admin()
        outcomes_res = (
            supabase.table("agent_memories")
            .select("*")
            .eq("project_id", project_id)
            .eq("memory_type", "outcome")
            .order("created_at", desc=True)
            .limit(5)
            .execute()
        )
        for row in outcomes_res.data or []:
            seen_ids.add(row["id"])
            recalled_memories.append({
                "id": row["id"],
                "title": row["title"],
                "content": row["content"],
                "type": row["memory_type"],
                "category": row["category"],
                "confidence": float(row.get("confidence", 0.95)),
                "is_experiment_outcome": True,
            })
    except Exception as e:
        logger.warning("Error fetching experiment outcome memories: %s", e)

    # 2. Query Hindsight across SEO, GEO, and User Policy topics
    topics = [
        "content comparison FAQ citation",
        "technical schema meta structured data",
        "human approval policy user preference",
    ]

    for t in topics:
        try:
            memories = await hindsight.recall(project_id=project_id, query_context=t, limit=3)
            for m in memories:
                if m.id and m.id not in seen_ids:
                    seen_ids.add(m.id)
                    recalled_memories.append({
                        "id": m.id,
                        "title": m.title,
                        "content": m.content,
                        "type": m.memory_type,
                        "category": m.category,
                        "confidence": m.confidence,
                        "is_experiment_outcome": False,
                    })
        except Exception as e:
            logger.warning("Hindsight recall error: %s", e)

    return {
        "recalled_memories": recalled_memories,
        "execution_log": log,
    }


# ── Node 6: Reason ────────────────────────────────────────────────────────────

async def reason_node(state: LangGraphAgentState) -> Dict[str, Any]:
    """Synthesizes observations, evidence, hypotheses, and historical memory into reasoning."""
    log = state.get("execution_log", [])
    log.append("reason: Synthesizing current observations with historical memory and competitor evidence.")

    seo = state.get("seo_analysis", {})
    geo = state.get("geo_analysis", {})
    competitors = state.get("competitor_research", [])
    memories = state.get("recalled_memories", [])

    synthesis: Dict[str, Any] = {
        "key_observations": [],
        "evidence_dossier": [],
        "applicable_learnings": [m["content"] for m in memories[:3]],
        "opportunity_themes": [],
    }

    # 1. GEO visibility gaps
    missing_geo = geo.get("queries_missing_citations", [])
    if missing_geo:
        for item in missing_geo[:3]:
            synthesis["key_observations"].append(
                f"Observed lack of website citations for query '{item['query']}' across {', '.join(item['tested_providers'])}."
            )
            synthesis["opportunity_themes"].append("geo_citability_enhancement")

    # 2. SEO technical / schema gaps
    missing_schema = seo.get("missing_schema_pages", [])
    if missing_schema:
        synthesis["key_observations"].append(
            f"Observed {len(missing_schema)} pages lacking structured schema.org markup."
        )
        synthesis["opportunity_themes"].append("schema_structured_data")

    # 3. GSC CTR opportunities
    low_ctr = seo.get("low_ctr_opportunities", [])
    if low_ctr:
        for item in low_ctr[:2]:
            synthesis["key_observations"].append(
                f"Observed page '{item['page']}' ranking for '{item['query']}' (position {item['position']:.1f}) with below-average CTR ({item['ctr']}%) on {item['impressions']} impressions."
            )
            synthesis["opportunity_themes"].append("ctr_title_faq_optimization")

    # 4. Critical technical issues
    critical_issues = seo.get("critical_issues", [])
    if critical_issues:
        for iss in critical_issues[:2]:
            synthesis["key_observations"].append(
                f"Technical issue observed: {iss.get('issue')} on {iss.get('affected_url') or 'site'}."
            )
            synthesis["opportunity_themes"].append("technical_remediation")

    # 5. Prior experiment learnings from Hindsight
    experiment_outcomes = [m for m in memories if m.get("is_experiment_outcome")]
    for exp_mem in experiment_outcomes[:2]:
        synthesis["key_observations"].append(
            f"Prior Project Experiment Evidence: {exp_mem['title']} — {exp_mem['content'][:200]}"
        )
        synthesis["evidence_dossier"].append(
            f"Closed-loop trial outcome: {exp_mem['title']}"
        )

    return {
        "reasoning_synthesis": synthesis,
        "execution_log": log,
    }


# ── Node 7: Generate Recommendations ──────────────────────────────────────────

async def generate_recommendations_node(state: LangGraphAgentState) -> Dict[str, Any]:
    """Generates structured, actionable recommendations with explicit hypotheses and experiments."""
    log = state.get("execution_log", [])
    log.append("generate_recommendations: Creating structured, evidence-backed recommendation proposals.")

    project_id = state["project_id"]
    website_url = state.get("website_url", "")
    target_brand = state.get("target_brand", "")
    seo = state.get("seo_analysis", {})
    geo = state.get("geo_analysis", {})
    competitors = state.get("competitor_research", [])
    memories = state.get("recalled_memories", [])
    synthesis = state.get("reasoning_synthesis", {})

    raw_recommendations: List[RecommendationModel] = []

    # Memory reference helper
    memory_notes = [f"{m['title']}: {m['content']}" for m in memories[:2]]

    # ── Rec 1: GEO Citability & Comparison Content ────────────────────────────
    missing_geo = geo.get("queries_missing_citations", [])
    if missing_geo:
        target_q = missing_geo[0]["query"]
        comp_domains = geo.get("frequently_cited_competitor_domains", [])
        raw_recommendations.append(
            RecommendationModel(
                project_id=project_id,
                title=f"Add structured comparison section for '{target_q}'",
                type="content",
                priority="high",
                action=(
                    f"Create an objective comparison and FAQ section addressing the search query '{target_q}'. "
                    "Include concise definitions, feature matrices, and factual answers formatted for easy AI parsing."
                ),
                reason=(
                    f"API checks observed that the brand is not cited as a source for '{target_q}', "
                    f"while competitors ({', '.join(comp_domains[:2]) or 'competing domains'}) are frequently referenced."
                ),
                hypothesis=(
                    "Structuring content with explicit comparison tables and Q&A formats increases the likelihood of search-grounded "
                    "AI completions citing the website as an authoritative source."
                ),
                confidence=0.88,
                status="pending",
                evidence=[
                    f"Query '{target_q}' tested with 0 citations observed.",
                    f"Competitor domains observed in completions: {', '.join(comp_domains[:2]) or 'Third-party sources'}.",
                ],
                affected_pages=[website_url],
                affected_queries=[target_q],
                geo_observations=[{"query": target_q, "missing_citation": True}],
                competitor_observations=[{"domains": comp_domains}],
                historical_memory=memory_notes,
                suggested_experiment=(
                    f"Publish a comparison section on the main relevant landing page for '{target_q}'. "
                    "Run visibility checks weekly for 28 days to observe whether citation status changes from ✗ to ✓."
                ),
                measurement_criteria=[
                    "Observable AI citations across OpenAI and Gemini",
                    "Brand mentions in grounded completions",
                    "Organic clicks from related search queries",
                ],
                requires_approval=True,
            )
        )

    # ── Rec 2: High Impression Low CTR Optimization ───────────────────────────
    low_ctr = seo.get("low_ctr_opportunities", [])
    if low_ctr:
        opp = low_ctr[0]
        raw_recommendations.append(
            RecommendationModel(
                project_id=project_id,
                title=f"Optimize title and snippet for '{opp['query']}' to improve CTR",
                type="metadata",
                priority="high",
                action=(
                    f"Rewrite the title tag and meta description of {opp['page']} to directly reflect user intent for '{opp['query']}'. "
                    "Add active value propositions and concise answers to improve snippet appeal."
                ),
                reason=(
                    f"The page has high impressions ({opp['impressions']}) and an average ranking of {opp['position']:.1f}, "
                    f"but receives only a {opp['ctr']:.1f}% click-through rate."
                ),
                hypothesis=(
                    "Improving snippet relevance and click clarity will increase CTR without requiring a higher rank position."
                ),
                confidence=0.85,
                status="pending",
                evidence=[
                    f"Search Console recorded {opp['impressions']} impressions with only {opp['clicks']} clicks.",
                    f"Current position: {opp['position']:.1f}, current CTR: {opp['ctr']:.1f}%.",
                ],
                affected_pages=[opp["page"]],
                affected_queries=[opp["query"]],
                historical_memory=memory_notes,
                suggested_experiment=(
                    f"Update the title and description on {opp['page']}. "
                    "Monitor Google Search Console impressions and CTR over a 21-day evaluation window."
                ),
                measurement_criteria=[
                    "CTR increase of at least 1.5%",
                    "Total organic clicks",
                    "Average position stability",
                ],
                requires_approval=True,
            )
        )

    # ── Rec 3: Structured Schema.org Implementation ───────────────────────────
    missing_schema = seo.get("missing_schema_pages", [])
    if missing_schema:
        target_page = missing_schema[0]
        raw_recommendations.append(
            RecommendationModel(
                project_id=project_id,
                title=f"Deploy JSON-LD structured schema on key landing pages",
                type="schema",
                priority="medium",
                action=(
                    f"Add JSON-LD Organization, WebSite, and FAQPage/Article structured data to {target_page}. "
                    "Ensure entity names, authors, and primary topic references are machine-readable."
                ),
                reason=(
                    f"Audit scan detected no structured schema markup on {target_page}, "
                    "preventing search engines and AI crawlers from definitively resolving your core entity relationships."
                ),
                hypothesis=(
                    "Providing clear schema.org entities improves search engine comprehension and rich snippet eligibility."
                ),
                confidence=0.90,
                status="pending",
                evidence=[
                    f"Crawl audit verified 0 schema tags on {target_page}.",
                ],
                affected_pages=[target_page],
                historical_memory=memory_notes,
                suggested_experiment=(
                    f"Inject valid JSON-LD schema into {target_page} and validate with Schema Validator. "
                    "Track Google Search Console rich results appearances over 30 days."
                ),
                measurement_criteria=[
                    "Schema.org markup validation passes with 0 errors",
                    "Rich snippet appearances in search console",
                ],
                requires_approval=True,
            )
        )

    # ── Rec 4: Technical SEO Remediation ──────────────────────────────────────
    critical_issues = seo.get("critical_issues", [])
    if critical_issues:
        first_issue = critical_issues[0]
        raw_recommendations.append(
            RecommendationModel(
                project_id=project_id,
                title=f"Remediate {first_issue.get('category', 'technical')} issue: {first_issue.get('issue')}",
                type="technical",
                priority="high" if first_issue.get("severity") == "critical" else "medium",
                action=first_issue.get("recommendation", "Resolve the identified audit flaw."),
                reason=f"Technical audit flagged '{first_issue.get('issue')}' with evidence: {first_issue.get('evidence') or 'detected by crawler'}.",
                hypothesis="Resolving technical crawl barriers ensures search engines and AI crawlers index the full page without penalties.",
                confidence=0.92,
                status="pending",
                evidence=[
                    f"SEO issue severity: {first_issue.get('severity')}",
                    f"Evidence: {first_issue.get('evidence') or 'crawler inspection'}",
                ],
                affected_pages=[first_issue.get("affected_url") or website_url],
                historical_memory=memory_notes,
                suggested_experiment="Deploy technical fix and run a re-crawl audit to verify resolution.",
                measurement_criteria=[
                    "SEO Health Score improvement in audit engine",
                    "Issue eliminated from re-crawl findings",
                ],
                requires_approval=True,
            )
        )

    return {
        "raw_recommendations": [r.model_dump() for r in raw_recommendations],
        "execution_log": log,
    }


# ── Node 8: Validate Recommendations ──────────────────────────────────────────

async def validate_recommendations_node(state: LangGraphAgentState) -> Dict[str, Any]:
    """
    Validates recommendations against strict platform safety and quality rules:
    - Has supporting evidence
    - Does NOT claim guaranteed ranking increase or guaranteed AI citation
    - Does NOT automatically modify website (requires_approval must be True)
    - Has explicit measurement criteria
    - Not a duplicate of existing pending recommendation
    """
    log = state.get("execution_log", [])
    log.append("validate_recommendations: Filtering proposals against safety, evidence, and duplicate rules.")

    project_id = state["project_id"]
    supabase = get_supabase_admin()
    raw = state.get("raw_recommendations", [])

    # Fetch existing active recommendations to prevent duplicate proposals
    existing_res = (
        supabase.table("recommendations")
        .select("title, action, status")
        .eq("project_id", project_id)
        .in_("status", ["pending", "approved", "implemented"])
        .execute()
    )
    existing_titles = {r["title"].lower().strip() for r in (existing_res.data or [])}

    validated: List[Dict[str, Any]] = []

    for item in raw:
        title = item.get("title", "").strip()

        # Rule 1: Supporting evidence required
        evidence = item.get("evidence", [])
        if not evidence or len(evidence) == 0:
            logger.warning("Rejected recommendation '%s': Missing supporting evidence", title)
            continue

        # Rule 2: No guaranteed claims
        text_corpus = (title + " " + item.get("reason", "") + " " + item.get("hypothesis", "")).lower()
        if "guaranteed rank" in text_corpus or "guaranteed #1" in text_corpus or "100% citation" in text_corpus:
            logger.warning("Rejected recommendation '%s': Unsubstantiated guarantee claim", title)
            continue

        # Rule 3: Must require explicit approval (no automatic site modification)
        item["requires_approval"] = True

        # Rule 4: Must have measurement criteria
        criteria = item.get("measurement_criteria", [])
        if not criteria or len(criteria) == 0:
            item["measurement_criteria"] = ["Organic Search Impressions", "Average Position Stability"]

        # Rule 5: Duplicate prevention
        if title.lower() in existing_titles:
            logger.info("Skipping duplicate recommendation already present in Supabase: '%s'", title)
            continue

        validated.append(item)

    return {
        "validated_recommendations": validated,
        "execution_log": log,
    }


# ── Node 9: Save Recommendations ─────────────────────────────────────────────

async def save_recommendations_node(state: LangGraphAgentState) -> Dict[str, Any]:
    """Persists validated recommendations into Supabase and retains an agent memory log."""
    log = state.get("execution_log", [])
    log.append("save_recommendations: Storing recommendations in Supabase and updating Hindsight memory.")

    project_id = state["project_id"]
    supabase = get_supabase_admin()
    validated = state.get("validated_recommendations", [])
    saved_records: List[Dict[str, Any]] = []

    if validated:
        rows_to_insert = []
        for v in validated:
            rows_to_insert.append({
                "project_id": project_id,
                "title": v["title"],
                "type": v["type"],
                "priority": v["priority"],
                "action": v["action"],
                "reason": v["reason"],
                "hypothesis": v["hypothesis"],
                "confidence": v.get("confidence", 0.85),
                "status": "pending",
                "evidence": v.get("evidence", []),
                "affected_pages": v.get("affected_pages", []),
                "affected_queries": v.get("affected_queries", []),
                "geo_observations": v.get("geo_observations", []),
                "competitor_observations": v.get("competitor_observations", []),
                "historical_memory": v.get("historical_memory", []),
                "suggested_experiment": v.get("suggested_experiment", ""),
                "measurement_criteria": v.get("measurement_criteria", []),
                "requires_approval": True,
            })

        try:
            res = supabase.table("recommendations").insert(rows_to_insert).execute()
            saved_records = res.data or []
            log.append(f"save_recommendations: Successfully persisted {len(saved_records)} recommendations.")

            # Record a reflection in Hindsight
            hindsight = HindsightMemoryService()
            await hindsight.retain(
                project_id=project_id,
                memory=MemoryModel(
                    project_id=project_id,
                    memory_type="strategy",
                    category="seo",
                    title="Intelligence Pipeline Run",
                    content=(
                        f"Agent generated {len(saved_records)} recommendations covering "
                        f"{', '.join(set(v['type'] for v in validated))}. Awaiting human review."
                    ),
                    confidence=0.9,
                    tags=["pipeline_run", "recommendations"],
                ),
            )
        except Exception as e:
            logger.error("Failed to insert recommendations into Supabase: %s", e)
            state.setdefault("errors", []).append(f"save_error: {str(e)}")

    return {
        "saved_recommendations": saved_records,
        "execution_log": log,
    }


# ── LangGraph Workflow Assembly ───────────────────────────────────────────────

def build_recommendation_graph() -> StateGraph:
    """Builds the compiled LangGraph StateGraph connecting all 9 intelligence nodes."""
    workflow = StateGraph(LangGraphAgentState)

    # 1. Register Nodes
    workflow.add_node("collect_data", collect_data_node)
    workflow.add_node("analyze_seo", analyze_seo_node)
    workflow.add_node("analyze_geo", analyze_geo_node)
    workflow.add_node("research_competitors", research_competitors_node)
    workflow.add_node("recall_memory", recall_memory_node)
    workflow.add_node("reason", reason_node)
    workflow.add_node("generate_recommendation", generate_recommendations_node)
    workflow.add_node("validate_recommendation", validate_recommendations_node)
    workflow.add_node("save_recommendation", save_recommendations_node)

    # 2. Wire Linear Edges
    workflow.add_edge(START, "collect_data")
    workflow.add_edge("collect_data", "analyze_seo")
    workflow.add_edge("analyze_seo", "analyze_geo")
    workflow.add_edge("analyze_geo", "research_competitors")
    workflow.add_edge("research_competitors", "recall_memory")
    workflow.add_edge("recall_memory", "reason")
    workflow.add_edge("reason", "generate_recommendation")
    workflow.add_edge("generate_recommendation", "validate_recommendation")
    workflow.add_edge("validate_recommendation", "save_recommendation")
    workflow.add_edge("save_recommendation", END)

    return workflow


# Compiled singleton instance
recommendation_agent_graph = build_recommendation_graph().compile()


async def run_intelligence_pipeline(
    project_id: str,
    project_name: str,
    website_url: str,
    target_brand: str,
    user_access_token: Optional[str] = None,
) -> LangGraphAgentState:
    """Entrypoint executing the complete LangGraph recommendation intelligence graph."""
    initial_state: LangGraphAgentState = {
        "project_id": project_id,
        "project_name": project_name,
        "website_url": website_url,
        "target_brand": target_brand,
        "user_access_token": user_access_token,
        "errors": [],
        "execution_log": ["Pipeline started."],
    }
    final_state = await recommendation_agent_graph.ainvoke(initial_state)
    return final_state
