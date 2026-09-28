"""Google Gemini provider implementation with search grounding and citation extraction."""

import logging
from typing import List, Optional
import httpx

from app.core.config import get_settings
from app.services.geo.base_provider import AIProvider
from app.services.geo.models import NormalizedAIResponse, ProviderCapability

logger = logging.getLogger(__name__)


class GeminiProvider(AIProvider):
    name: str = "gemini"
    default_model: str = "gemini-2.5-flash"

    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None):
        settings = get_settings()
        self.api_key = api_key if api_key is not None else settings.gemini_api_key
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
                message="GEMINI_API_KEY environment variable is not set.",
            )
        return ProviderCapability(
            provider=self.name,
            configured=True,
            web_search_supported=True,
            model=self.model,
            status="connected",
            message="Ready with Google Search grounding.",
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
                error="Gemini API key not configured.",
            )

        url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent?key={self.api_key}"

        # Payload enabling Google Search grounding
        payload = {
            "contents": [
                {
                    "parts": [
                        {
                            "text": (
                                f"Answer this search query factually and thoroughly: {query}. "
                                "Cite the relevant website URLs, official resources, and brand sources you refer to."
                            )
                        }
                    ]
                }
            ],
            "tools": [{"google_search": {}}],
        }

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                res = await client.post(url, json=payload)

                # Fallback if google_search tool is rejected on standard tier: retry without explicit tool
                if res.status_code == 400 and "tool" in res.text.lower():
                    payload.pop("tools", None)
                    res = await client.post(url, json=payload)

                if res.status_code != 200:
                    err_text = res.text[:200]
                    return NormalizedAIResponse(
                        provider=self.name,
                        model=self.model,
                        query=query,
                        status="failed",
                        error=f"Gemini API HTTP {res.status_code}: {err_text}",
                    )

                data = res.json()
                candidate = data.get("candidates", [{}])[0]
                content_parts = candidate.get("content", {}).get("parts", [])
                answer_text = "".join(p.get("text", "") for p in content_parts)

                # Extract grounding metadata if present
                grounding_urls: List[str] = []
                grounding_metadata = candidate.get("groundingMetadata", {})
                for chunk in grounding_metadata.get("groundingChunks", []):
                    web_info = chunk.get("web", {})
                    if web_info.get("uri"):
                        grounding_urls.append(web_info["uri"])

                # Also extract inline URLs from text
                extracted_urls = list(dict.fromkeys(grounding_urls + self.extract_urls(answer_text)))

                brand_mentioned = self.is_brand_mentioned(target_brand, answer_text)
                is_cited, cited_domains, matched_comps, sources = self.evaluate_citations(
                    extracted_urls, target_domain, competitor_domains
                )

                return NormalizedAIResponse(
                    provider=self.name,
                    model=self.model,
                    query=query,
                    answer=answer_text,
                    brand_mentioned=brand_mentioned,
                    website_cited=is_cited,
                    cited_urls=extracted_urls,
                    cited_domains=cited_domains,
                    competitor_domains=matched_comps,
                    sources=sources,
                    status="completed",
                    raw_response={"grounding_queries": grounding_metadata.get("webSearchQueries", [])},
                )

        except Exception as e:
            logger.exception(f"Gemini provider query error: {e}")
            return NormalizedAIResponse(
                provider=self.name,
                model=self.model,
                query=query,
                status="failed",
                error=f"Gemini query execution failed: {str(e)[:200]}",
            )
