"""Tavily web research and competitor intelligence service."""

import logging
from typing import Any, Dict, List, Optional
import httpx

from app.core.config import get_settings
from app.services.crawler.url_utils import get_base_domain, is_same_domain
from app.services.geo.models import SourceReference

logger = logging.getLogger(__name__)


class TavilyResearchService:
    """Independent search baseline and competitor research service using Tavily API."""

    def __init__(self, api_key: Optional[str] = None):
        settings = get_settings()
        self.api_key = api_key if api_key is not None else settings.tavily_api_key

    def is_configured(self) -> bool:
        return bool(self.api_key and len(self.api_key.strip()) > 5)

    async def search_baseline(
        self,
        query: str,
        target_domain: str = "",
        competitor_domains: Optional[List[str]] = None,
        max_results: int = 10,
    ) -> Dict[str, Any]:
        """
        Executes public web research query to observe organic web sources,
        competitor domain presence, and whether target domain appears in organic results.
        """
        if not self.is_configured():
            return {
                "status": "not_configured",
                "query": query,
                "source": "Tavily Web Search",
                "message": "TAVILY_API_KEY environment variable is not configured.",
                "error": "TAVILY_API_KEY environment variable is not configured.",
                "results": [],
                "direct_results": [],
                "identified_domains": [],
                "target_domain_found": False,
                "competitor_domains_found": [],
                "results_count": 0,
            }

        payload = {
            "api_key": self.api_key,
            "query": query,
            "search_depth": "basic",
            "include_domains": [],
            "exclude_domains": [],
            "max_results": max_results,
        }

        try:
            async with httpx.AsyncClient(timeout=25.0) as client:
                res = await client.post("https://api.tavily.com/search", json=payload)
                if res.status_code != 200:
                    err_msg = f"Tavily API HTTP {res.status_code}: {res.text[:150]}"
                    return {
                        "status": "failed",
                        "query": query,
                        "source": "Tavily Web Search",
                        "error": err_msg,
                        "message": err_msg,
                        "results": [],
                        "direct_results": [],
                        "identified_domains": [],
                        "competitor_domains_found": [],
                        "results_count": 0,
                    }

                data = res.json()
                raw_results = data.get("results", [])

                clean_target = get_base_domain(target_domain) if target_domain else ""
                competitors = [get_base_domain(c) for c in (competitor_domains or []) if c]

                results_list: List[Dict[str, Any]] = []
                target_found = False
                found_competitors: List[str] = []
                all_discovered_domains: List[str] = []

                for r in raw_results:
                    u = r.get("url", "")
                    dom = get_base_domain(u)
                    if dom and dom not in all_discovered_domains:
                        all_discovered_domains.append(dom)

                    is_target = bool(clean_target and is_same_domain(u, clean_target))
                    if is_target:
                        target_found = True

                    is_comp = any(is_same_domain(u, c) for c in competitors)
                    if is_comp and dom not in found_competitors:
                        found_competitors.append(dom)

                    snippet_text = r.get("content", "") or ""
                    results_list.append(
                        {
                            "title": r.get("title", ""),
                            "url": u,
                            "domain": dom,
                            "content": snippet_text,
                            "snippet": snippet_text,
                            "score": r.get("score"),
                            "is_own_domain": is_target,
                            "is_competitor": is_comp or (not is_target and bool(dom)),
                        }
                    )

                # Competitor domains are non-target domains appearing in top search results
                identified_competitors = [
                    d for d in all_discovered_domains
                    if clean_target and not is_same_domain(d, clean_target)
                ] or all_discovered_domains

                summary_text = (
                    f"Found {len(results_list)} live web search results across {len(all_discovered_domains)} domains. "
                    f"{'Target domain was found in results. ' if target_found else 'Target domain not detected in top results. '}"
                    f"Identified {len(identified_competitors)} relevant competitor/source domains."
                )

                return {
                    "status": "completed",
                    "query": query,
                    "source": "Tavily Web Search",
                    "target_domain_found": target_found,
                    "competitor_domains_found": found_competitors or identified_competitors,
                    "identified_domains": identified_competitors,
                    "results_count": len(results_list),
                    "results": results_list,
                    "direct_results": results_list,
                    "summary": summary_text,
                }

        except Exception as e:
            logger.exception(f"Tavily search error: {e}")
            err_msg = f"Tavily execution error: {str(e)[:150]}"
            return {
                "status": "failed",
                "query": query,
                "source": "Tavily Web Search",
                "error": err_msg,
                "message": err_msg,
                "results": [],
                "direct_results": [],
                "identified_domains": [],
                "competitor_domains_found": [],
                "results_count": 0,
            }

    async def research_competitor_context(
        self,
        query: str,
        target_domain: str = "",
        competitor_domains: Optional[List[str]] = None,
        max_results: int = 6,
    ) -> Dict[str, Any]:
        """Context research for LangGraph agent and competitor intelligence."""
        return await self.search_baseline(
            query=query,
            target_domain=target_domain,
            competitor_domains=competitor_domains,
            max_results=max_results,
        )
