"""GEO Visibility Analyzer coordinating multi-provider AI answer queries and citation analysis."""

import asyncio
from datetime import datetime
import logging
from typing import Any, Dict, List, Optional

from app.core.database import get_supabase_admin
from app.services.crawler.url_utils import get_base_domain
from app.services.geo.base_provider import AIProvider
from app.services.geo.claude_provider import ClaudeProvider
from app.services.geo.gemini_provider import GeminiProvider
from app.services.geo.grok_provider import GrokProvider
from app.services.geo.models import (
    NormalizedAIResponse,
    ProviderCapability,
    QueryVisibilitySummary,
)
from app.services.geo.openai_provider import OpenAIProvider

logger = logging.getLogger(__name__)


class GEOVisibilityAnalyzer:
    """Orchestrates multi-provider AI search checks, citation extraction, and database persistence."""

    def __init__(
        self,
        providers: Optional[List[AIProvider]] = None,
    ):
        self.providers: List[AIProvider] = providers or [
            OpenAIProvider(),
            GeminiProvider(),
            ClaudeProvider(),
            GrokProvider(),
        ]

    def get_capabilities(self) -> List[ProviderCapability]:
        """Returns the current operational status of all supported AI providers."""
        return [p.get_capability() for p in self.providers]

    async def check_query(
        self,
        project_id: str,
        query_id: str,
        query_text: str,
        target_brand: str,
        target_domain: str,
        category: str = "general",
        competitor_domains: Optional[List[str]] = None,
        access_token: Optional[str] = None,
    ) -> QueryVisibilitySummary:
        """
        Executes query concurrently across all configured AI providers,
        persisting individual check records and citations into Supabase.
        """
        clean_target_domain = get_base_domain(target_domain)

        # 1. Run checks concurrently across all providers
        async def run_single(provider: AIProvider) -> NormalizedAIResponse:
            try:
                return await provider.execute_query(
                    query=query_text,
                    target_brand=target_brand,
                    target_domain=clean_target_domain,
                    competitor_domains=competitor_domains,
                )
            except Exception as e:
                logger.exception(f"Unhandled provider error in {provider.name}: {e}")
                return NormalizedAIResponse(
                    provider=provider.name,
                    model=provider.default_model,
                    query=query_text,
                    status="failed",
                    error=f"Execution error: {str(e)[:150]}",
                )

        tasks = [run_single(p) for p in self.providers]
        responses: List[NormalizedAIResponse] = await asyncio.gather(*tasks)

        # 2. Tally metrics
        configured_count = sum(1 for p in self.providers if p.is_configured())
        tested_count = sum(1 for r in responses if r.status == "completed")
        cited_count = sum(1 for r in responses if r.status == "completed" and r.website_cited)
        mentioned_count = sum(1 for r in responses if r.status == "completed" and r.brand_mentioned)

        coverage_pct = round((cited_count / max(1, tested_count)) * 100.0, 1) if tested_count > 0 else 0.0

        all_competitors: List[str] = []
        for r in responses:
            for c in r.competitor_domains:
                if c not in all_competitors:
                    all_competitors.append(c)

        summary = QueryVisibilitySummary(
            query_id=query_id,
            query=query_text,
            category=category,
            target_entity=target_brand,
            providers_configured=configured_count,
            providers_tested=tested_count,
            providers_cited=cited_count,
            providers_mentioned=mentioned_count,
            citation_coverage_pct=coverage_pct,
            responses=responses,
            competitors_cited=all_competitors,
        )

        # 3. Persist to Supabase
        await self._persist_checks(
            project_id=project_id,
            query_id=query_id,
            responses=responses,
            access_token=access_token,
        )

        return summary

    async def _persist_checks(
        self,
        project_id: str,
        query_id: str,
        responses: List[NormalizedAIResponse],
        access_token: Optional[str] = None,
    ) -> None:
        """Saves check records and citations into Supabase with RLS compatibility."""
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

        for r in responses:
            try:
                # Insert visibility check record
                check_data = {
                    "project_id": project_id,
                    "query_id": query_id,
                    "provider": r.provider,
                    "model": r.model,
                    "timestamp": r.timestamp.isoformat(),
                    "response_text": r.answer[:3000] if r.answer else None,
                    "brand_mentioned": r.brand_mentioned,
                    "website_cited": r.website_cited,
                    "cited_urls": r.cited_urls[:50],
                    "cited_domains": r.cited_domains[:50],
                    "competitor_domains": r.competitor_domains[:20],
                    "sources": [s.model_dump() for s in r.sources[:30]],
                    "status": r.status,
                    "error": r.error,
                }

                res = supabase.table("ai_visibility_checks").insert(check_data).execute()
                if res.data and len(res.data) > 0:
                    check_id = res.data[0]["id"]
                    # Insert individual citations
                    citations_data = []
                    for s in r.sources[:20]:
                        citations_data.append(
                            {
                                "visibility_check_id": check_id,
                                "project_id": project_id,
                                "url": s.url,
                                "domain": s.domain,
                                "title": s.title,
                                "citation_order": s.order,
                                "is_own_domain": s.is_own_domain,
                                "is_competitor": s.is_competitor,
                            }
                        )

                    if citations_data:
                        supabase.table("ai_citations").insert(citations_data).execute()

            except Exception as e:
                logger.warning(f"Could not persist visibility check for {r.provider}: {e}")
