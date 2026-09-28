"""Abstract base provider and extraction utilities for AI answer/search engines."""

from abc import ABC, abstractmethod
import re
from typing import List, Optional
from urllib.parse import urlparse

from app.services.crawler.url_utils import get_base_domain, is_same_domain
from app.services.geo.models import NormalizedAIResponse, ProviderCapability, SourceReference


class AIProvider(ABC):
    """Abstract base class for all AI answer and search intelligence providers."""

    name: str = "base"
    default_model: str = "unknown"

    @abstractmethod
    def is_configured(self) -> bool:
        """Returns True if the required API key/credentials are present."""
        pass

    @abstractmethod
    def supports_web_search(self) -> bool:
        """Returns True if this provider supports live web grounding/search."""
        pass

    @abstractmethod
    def get_capability(self) -> ProviderCapability:
        """Returns current operational status and capabilities for this provider."""
        pass

    @abstractmethod
    async def execute_query(
        self,
        query: str,
        target_brand: str,
        target_domain: str,
        competitor_domains: Optional[List[str]] = None,
    ) -> NormalizedAIResponse:
        """
        Executes query against the AI search provider and returns a normalized response.
        Must handle errors gracefully without raising unhandled exceptions.
        """
        pass

    # ── Utility Helpers ───────────────────────────────────────────

    @classmethod
    def extract_urls(cls, text: str) -> List[str]:
        """Extracts all HTTP/HTTPS URLs from raw text and markdown links."""
        urls: List[str] = []
        # Markdown links [title](url)
        markdown_urls = re.findall(r"\[.*?\]\((https?://[^\s\)]+)\)", text)
        urls.extend(markdown_urls)

        # Raw URLs
        raw_urls = re.findall(r"https?://[^\s\)\],\"'<>]+", text)
        for u in raw_urls:
            # Strip trailing punctuation
            u = u.rstrip(".,;:!?")
            if u not in urls:
                urls.append(u)

        return urls

    @classmethod
    def extract_domain(cls, url: str) -> str:
        """Extracts clean host/domain from URL."""
        return get_base_domain(url)

    @classmethod
    def is_brand_mentioned(cls, brand: str, text: str) -> bool:
        """Case-insensitive check for presence of brand name as a word."""
        if not brand or not text:
            return False
        pattern = r"\b" + re.escape(brand.strip()) + r"\b"
        return bool(re.search(pattern, text, re.IGNORECASE))

    @classmethod
    def evaluate_citations(
        cls,
        urls: List[str],
        target_domain: str,
        competitor_domains: Optional[List[str]] = None,
    ) -> tuple[bool, List[str], List[str], List[SourceReference]]:
        """
        Categorizes extracted URLs into own domain vs competitors vs third-party sources.
        Returns: (is_target_cited, cited_domains, matched_competitors, sources)
        """
        competitors = [get_base_domain(c) for c in (competitor_domains or []) if c]
        clean_target = get_base_domain(target_domain)

        cited_domains: List[str] = []
        matched_competitors: List[str] = []
        sources: List[SourceReference] = []
        is_target_cited = False

        for idx, u in enumerate(urls, start=1):
            domain = cls.extract_domain(u)
            if not domain:
                continue

            if domain not in cited_domains:
                cited_domains.append(domain)

            is_own = is_same_domain(u, clean_target)
            if is_own:
                is_target_cited = True

            is_comp = any(is_same_domain(u, c) for c in competitors)
            if is_comp and domain not in matched_competitors:
                matched_competitors.append(domain)

            sources.append(
                SourceReference(
                    url=u,
                    domain=domain,
                    order=idx,
                    is_own_domain=is_own,
                    is_competitor=is_comp,
                )
            )

        return is_target_cited, cited_domains, matched_competitors, sources
