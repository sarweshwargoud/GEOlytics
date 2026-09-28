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
        self.api_key = api_key or settings.tavily_api_key

    def is_configured(self) -> bool:
        return bool(self.api_key and len(self.api_key.strip()) > 5)

    async def search_baseline(
        self,
        query: str,
        target_domain: str,
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
                "message": "TAVILY_API_KEY environment variable is not configured.",
                "results": [],
                "target_domain_found": False,
                "competitor_domains_found": [],
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
            async with httpx.AsyncClient(timeout=20.0) as client:
                res = await client.post("https://api.tavily.com/search", json=payload)
                if res.status_code != 200:
                    return {
                        "status": "failed",
                        "query": query,
                        "error": f"Tavily API HTTP {res.status_code}: {res.text[:150]}",
                        "results": [],
                    }

                data = res.json()
                raw_results = data.get("results", [])

                clean_target = get_base_domain(target_domain)
                competitors = [get_base_domain(c) for c in (competitor_domains or []) if c]

                results_list: List[Dict[str, Any]] = []
                target_found = False
                found_competitors: List[str] = []

                for r in raw_results:
                    u = r.get("url", "")
                    dom = get_base_domain(u)
                    is_target = is_same_domain(u, clean_target)
                    if is_target:
                        target_found = True

                    is_comp = any(is_same_domain(u, c) for c in competitors)
                    if is_comp and dom not in found_competitors:
                        found_competitors.append(dom)

                    results_list.append(
                        {
                            "title": r.get("title", ""),
                            "url": u,
                            "domain": dom,
                            "snippet": r.get("content", ""),
                            "is_own_domain": is_target,
                            "is_competitor": is_comp,
                        }
                    )

                return {
                    "status": "completed",
                    "query": query,
                    "target_domain_found": target_found,
                    "competitor_domains_found": found_competitors,
                    "results_count": len(results_list),
                    "results": results_list,
                }

        except Exception as e:
            logger.exception(f"Tavily search error: {e}")
            return {
                "status": "failed",
                "query": query,
                "error": f"Tavily execution error: {str(e)[:150]}",
                "results": [],
            }
