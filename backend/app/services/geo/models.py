"""Data models for multi-provider AI search (GEO) intelligence."""

from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class SourceReference(BaseModel):
    url: str
    domain: str
    title: Optional[str] = None
    snippet: Optional[str] = None
    order: int = 1
    is_own_domain: bool = False
    is_competitor: bool = False


class ProviderCapability(BaseModel):
    provider: str
    configured: bool
    web_search_supported: bool
    model: str
    status: str  # "connected", "not_configured", "unavailable", "error"
    message: Optional[str] = None


class NormalizedAIResponse(BaseModel):
    """Common normalized response format across all AI search providers."""

    provider: str  # "openai", "gemini", "claude", "grok", "tavily"
    model: str
    query: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    answer: str = ""
    brand_mentioned: bool = False
    website_cited: bool = False
    cited_urls: List[str] = Field(default_factory=list)
    cited_domains: List[str] = Field(default_factory=list)
    competitor_domains: List[str] = Field(default_factory=list)
    sources: List[SourceReference] = Field(default_factory=list)
    status: str = "completed"  # "completed", "failed", "unavailable"
    error: Optional[str] = None
    raw_response: Optional[Dict[str, Any]] = None


class QueryVisibilitySummary(BaseModel):
    """Aggregate multi-provider GEO visibility summary for a single tracked query."""

    query_id: str
    query: str
    category: str
    target_entity: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    providers_configured: int = 0
    providers_tested: int = 0
    providers_cited: int = 0
    providers_mentioned: int = 0
    citation_coverage_pct: float = 0.0
    responses: List[NormalizedAIResponse] = Field(default_factory=list)
    competitors_cited: List[str] = Field(default_factory=list)
