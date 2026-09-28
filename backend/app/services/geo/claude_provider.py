"""Anthropic Claude provider architecture and capability state."""

import logging
from typing import List, Optional

from app.core.config import get_settings
from app.services.geo.base_provider import AIProvider
from app.services.geo.models import NormalizedAIResponse, ProviderCapability

logger = logging.getLogger(__name__)


class ClaudeProvider(AIProvider):
    name: str = "claude"
    default_model: str = "claude-3-7-sonnet"

    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None):
        settings = get_settings()
        self.api_key = api_key if api_key is not None else settings.anthropic_api_key
        self.model = model or self.default_model

    def is_configured(self) -> bool:
        return bool(self.api_key and len(self.api_key.strip()) > 5)

    def supports_web_search(self) -> bool:
        # Standard Anthropic Messages API does not expose native web browsing/search tools
        return False

    def get_capability(self) -> ProviderCapability:
        if not self.is_configured():
            return ProviderCapability(
                provider=self.name,
                configured=False,
                web_search_supported=False,
                model=self.model,
                status="not_configured",
                message="ANTHROPIC_API_KEY environment variable is not set.",
            )
        return ProviderCapability(
            provider=self.name,
            configured=True,
            web_search_supported=False,
            model=self.model,
            status="unavailable",
            message="Claude API architecture is ready, but native live web search grounding is unavailable in this API tier.",
        )

    async def execute_query(
        self,
        query: str,
        target_brand: str,
        target_domain: str,
        competitor_domains: Optional[List[str]] = None,
    ) -> NormalizedAIResponse:
        # Explicitly do not fabricate search results
        if not self.is_configured():
            return NormalizedAIResponse(
                provider=self.name,
                model=self.model,
                query=query,
                status="unavailable",
                error="Claude API key not configured.",
            )

        return NormalizedAIResponse(
            provider=self.name,
            model=self.model,
            query=query,
            status="unavailable",
            error="Live web citation measurement is currently unavailable for Claude (requires native web browsing tool).",
        )
