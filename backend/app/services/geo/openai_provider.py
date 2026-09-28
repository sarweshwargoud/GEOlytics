"""OpenAI provider implementation for observable AI search visibility."""

import logging
from typing import List, Optional
import httpx

from app.core.config import get_settings
from app.services.geo.base_provider import AIProvider
from app.services.geo.models import NormalizedAIResponse, ProviderCapability

logger = logging.getLogger(__name__)


class OpenAIProvider(AIProvider):
    name: str = "openai"
    default_model: str = "gpt-4o"

    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None):
        settings = get_settings()
        self.api_key = api_key if api_key is not None else settings.openai_api_key
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
                message="OPENAI_API_KEY environment variable is not set.",
            )
        return ProviderCapability(
            provider=self.name,
            configured=True,
            web_search_supported=True,
            model=self.model,
            status="connected",
            message="Ready for API-observed AI search queries.",
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
                error="OpenAI API key not configured.",
            )

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        # Request with instruction to answer factually and include web citations/source URLs
        payload = {
            "model": self.model,
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "You are an AI answer and search assistant. Answer the user query thoroughly and factually. "
                        "Include the specific website URLs, sources, and company domains you cite as references in your answer."
                    ),
                },
                {"role": "user", "content": query},
            ],
            "temperature": 0.2,
            "max_tokens": 1000,
        }

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                res = await client.post(
                    "https://api.openai.com/v1/chat/completions",
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
                        error=f"OpenAI API HTTP {res.status_code}: {err_text}",
                    )

                data = res.json()
                content = data.get("choices", [{}])[0].get("message", {}).get("content", "")

                # Extract observable citations
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
                    raw_response={"id": data.get("id"), "usage": data.get("usage")},
                )

        except Exception as e:
            logger.exception(f"OpenAI provider query error: {e}")
            return NormalizedAIResponse(
                provider=self.name,
                model=self.model,
                query=query,
                status="failed",
                error=f"OpenAI query execution failed: {str(e)[:200]}",
            )
