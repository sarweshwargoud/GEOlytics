"""xAI Grok provider implementation for AI search observation."""

import logging
from typing import List, Optional
import httpx

from app.core.config import get_settings
from app.services.geo.base_provider import AIProvider
from app.services.geo.models import NormalizedAIResponse, ProviderCapability

logger = logging.getLogger(__name__)


class GrokProvider(AIProvider):
    name: str = "grok"
    default_model: str = "grok-2"

    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None):
        settings = get_settings()
        self.api_key = api_key or settings.xai_api_key
        self.model = model or self.default_model

    def is_configured(self) -> bool:
        return bool(self.api_key and len(self.api_key.strip()) > 5)

    def supports_web_search(self) -> bool:
        return True

    def get_capability(self) -> ProviderCapability:
        if not self.is_configured():
            return ProviderCapability(
                provider=self.name,
                configured=False,
                web_search_supported=True,
                model=self.model,
                status="not_configured",
                message="XAI_API_KEY environment variable is not set.",
            )
        return ProviderCapability(
            provider=self.name,
            configured=True,
            web_search_supported=True,
            model=self.model,
            status="connected",
            message="Ready for Grok web-search query observation.",
        )

    async def execute_query(
        self,
        query: str,
        target_brand: str,
        target_domain: str,
        competitor_domains: Optional[List[str]] = None,
    ) -> NormalizedAIResponse:
        if not self.is_configured():
            return NormalizedAIResponse(
                provider=self.name,
                model=self.model,
                query=query,
                status="unavailable",
                error="xAI API key not configured.",
            )

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        payload = {
            "model": self.model,
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "You are Grok search assistant. Answer the user question accurately. "
                        "Cite the relevant company websites, online services, and official URLs referenced in your answer."
                    ),
                },
                {"role": "user", "content": query},
            ],
            "temperature": 0.2,
        }

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                res = await client.post(
                    "https://api.x.ai/v1/chat/completions",
                    headers=headers,
                    json=payload,
                )

                if res.status_code != 200:
                    err_text = res.text[:200]
                    return NormalizedAIResponse(
                        provider=self.name,
                        model=self.model,
                        query=query,
                        status="failed",
                        error=f"xAI API HTTP {res.status_code}: {err_text}",
                    )

                data = res.json()
                content = data.get("choices", [{}])[0].get("message", {}).get("content", "")

                extracted_urls = self.extract_urls(content)
                brand_mentioned = self.is_brand_mentioned(target_brand, content)
                is_cited, cited_domains, matched_comps, sources = self.evaluate_citations(
                    extracted_urls, target_domain, competitor_domains
                )

                return NormalizedAIResponse(
                    provider=self.name,
                    model=self.model,
                    query=query,
                    answer=content,
                    brand_mentioned=brand_mentioned,
                    website_cited=is_cited,
                    cited_urls=extracted_urls,
                    cited_domains=cited_domains,
                    competitor_domains=matched_comps,
                    sources=sources,
                    status="completed",
                    raw_response={"id": data.get("id")},
                )

        except Exception as e:
            logger.exception(f"Grok provider query error: {e}")
            return NormalizedAIResponse(
                provider=self.name,
                model=self.model,
                query=query,
                status="failed",
                error=f"xAI query execution failed: {str(e)[:200]}",
            )
