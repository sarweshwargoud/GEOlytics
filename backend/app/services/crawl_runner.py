"""Crawl and audit execution manager handling database lifecycle and background runs."""

from datetime import datetime
import logging
from typing import Any, Dict, List, Optional
from app.core.database import get_supabase_admin
from app.services.analyzer.analyzer import SEOAuditService
from app.services.crawler.crawler import WebsiteCrawler
from app.services.crawler.models import CrawlOptions

logger = logging.getLogger(__name__)


async def run_crawl_job(
    project_id: str,
    crawl_run_id: str,
    website_url: str,
    max_pages: int = 25,
    max_depth: int = 3,
    access_token: Optional[str] = None,
) -> None:
    """Executes crawler and SEO audit in background, persisting all results to Supabase."""
    from app.core.config import get_settings
    from supabase import create_client

    s = get_settings()
    if s.supabase_service_role_key:
        supabase = get_supabase_admin()
    elif access_token:
        supabase = create_client(s.supabase_url, s.supabase_anon_key)
        supabase.postgrest.auth(access_token)
    else:
        supabase = get_supabase_admin()

    try:
        # 1. Update status to 'crawling'
        supabase.table("crawl_runs").update(
            {"status": "crawling", "started_at": datetime.utcnow().isoformat()}
        ).eq("id", crawl_run_id).execute()

        # 2. Run crawler
        options = CrawlOptions(max_pages=max_pages, max_depth=max_depth)
        crawler = WebsiteCrawler(base_url=website_url, options=options)
        crawled_pages, site_signals, count, failed = await crawler.crawl()

        # 3. Update status to 'analyzing'
        supabase.table("crawl_runs").update(
            {"status": "analyzing", "pages_crawled": count, "pages_failed": failed}
        ).eq("id", crawl_run_id).execute()

        # 4. Run SEO Audit Analyzer
        audit_summary = SEOAuditService.audit(crawled_pages, site_signals)

        # 5. Persist crawled pages
        pages_to_insert: List[Dict[str, Any]] = []
        for p in crawled_pages:
            pages_to_insert.append(
                {
                    "crawl_run_id": crawl_run_id,
                    "project_id": project_id,
                    "url": p.url,
                    "final_url": p.final_url,
                    "status_code": p.status_code,
                    "response_time_ms": p.response_time_ms,
                    "content_type": p.content_type,
                    "title": p.title,
                    "title_length": p.title_length,
                    "meta_description": p.meta_description,
                    "meta_description_length": p.meta_description_length,
                    "canonical": p.canonical,
                    "robots_meta": p.robots_meta,
                    "h1": p.h1,
                    "h2_data": p.h2_data,
                    "h3_data": p.h3_data,
                    "word_count": p.word_count,
                    "internal_links": [link.model_dump() for link in p.internal_links[:50]],
                    "external_links": [link.model_dump() for link in p.external_links[:50]],
                    "image_count": p.image_count,
                    "missing_alt_count": p.missing_alt_count,
                    "images_data": [img.model_dump() for img in p.images_data[:30]],
                    "schema_data": [s.model_dump() for s in p.schema_data],
                    "security_data": {
                        "is_https": p.is_https,
                        "mixed_content": p.mixed_content,
                    },
                    "crawled_at": p.crawled_at.isoformat(),
                }
            )

        # Batch insert pages (in chunks of 50 to respect payload limits)
        if pages_to_insert:
            for i in range(0, len(pages_to_insert), 50):
                supabase.table("crawl_pages").insert(pages_to_insert[i : i + 50]).execute()

        # 6. Map issues to inserted page IDs (if possible) and persist issues
        # Query inserted pages to create a URL -> page_id lookup map
        page_id_map: Dict[str, str] = {}
        try:
            pages_query = (
                supabase.table("crawl_pages")
                .select("id, url")
                .eq("crawl_run_id", crawl_run_id)
                .execute()
            )
            for row in pages_query.data or []:
                page_id_map[row["url"]] = row["id"]
        except Exception as e:
            logger.warning(f"Could not build page_id map: {e}")

        issues_to_insert: List[Dict[str, Any]] = []
        for issue in audit_summary.issues:
            matched_page_id = page_id_map.get(issue.affected_url) if issue.affected_url else None
            issues_to_insert.append(
                {
                    "crawl_run_id": crawl_run_id,
                    "project_id": project_id,
                    "page_id": matched_page_id,
                    "category": issue.category.value,
                    "severity": issue.severity.value,
                    "issue": issue.issue,
                    "affected_url": issue.affected_url,
                    "evidence": issue.evidence,
                    "recommendation": issue.recommendation,
                }
            )

        if issues_to_insert:
            for i in range(0, len(issues_to_insert), 50):
                supabase.table("seo_issues").insert(issues_to_insert[i : i + 50]).execute()

        # 7. Mark crawl_run as completed with score and category breakdowns
        supabase.table("crawl_runs").update(
            {
                "status": "completed",
                "completed_at": datetime.utcnow().isoformat(),
                "pages_crawled": count,
                "pages_failed": failed,
                "seo_health_score": audit_summary.seo_health_score,
                "category_scores": audit_summary.category_scores.model_dump(),
                "site_signals": site_signals.model_dump(),
            }
        ).eq("id", crawl_run_id).execute()

        logger.info(f"Crawl job {crawl_run_id} completed successfully with score {audit_summary.seo_health_score}")

    except Exception as e:
        logger.exception(f"Crawl job {crawl_run_id} encountered an error: {e}")
        supabase.table("crawl_runs").update(
            {
                "status": "failed",
                "completed_at": datetime.utcnow().isoformat(),
                "error": str(e)[:300],
            }
        ).eq("id", crawl_run_id).execute()
