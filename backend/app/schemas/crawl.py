"""Pydantic schemas for crawling and SEO audit endpoints."""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class CrawlTriggerRequest(BaseModel):
    max_pages: int = Field(default=25, ge=1, le=100, description="Maximum pages to crawl")
    max_depth: int = Field(default=3, ge=1, le=5, description="Maximum link depth")


class CrawlRunOut(BaseModel):
    id: str
    project_id: str
    status: str
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    pages_crawled: int = 0
    pages_failed: int = 0
    error: Optional[str] = None
    seo_health_score: Optional[float] = None
    category_scores: Dict[str, Any] = Field(default_factory=dict)
    site_signals: Dict[str, Any] = Field(default_factory=dict)
    created_at: str
    updated_at: Optional[str] = None


class CrawlPageOut(BaseModel):
    id: str
    crawl_run_id: str
    project_id: str
    url: str
    final_url: Optional[str] = None
    status_code: Optional[int] = None
    response_time_ms: Optional[int] = None
    content_type: Optional[str] = None
    title: Optional[str] = None
    title_length: Optional[int] = None
    meta_description: Optional[str] = None
    meta_description_length: Optional[int] = None
    canonical: Optional[str] = None
    robots_meta: Optional[str] = None
    h1: Optional[str] = None
    h2_data: List[str] = Field(default_factory=list)
    h3_data: List[str] = Field(default_factory=list)
    word_count: int = 0
    internal_links: List[Dict[str, Any]] = Field(default_factory=list)
    external_links: List[Dict[str, Any]] = Field(default_factory=list)
    image_count: int = 0
    missing_alt_count: int = 0
    images_data: List[Dict[str, Any]] = Field(default_factory=list)
    schema_data: List[Dict[str, Any]] = Field(default_factory=list)
    security_data: Dict[str, Any] = Field(default_factory=dict)
    crawled_at: str


class SEOIssueOut(BaseModel):
    id: str
    crawl_run_id: str
    project_id: str
    page_id: Optional[str] = None
    category: str
    severity: str
    issue: str
    affected_url: Optional[str] = None
    evidence: Optional[str] = None
    recommendation: str
    created_at: str


class AuditOverviewOut(BaseModel):
    latest_run: Optional[CrawlRunOut] = None
    total_pages_crawled: int = 0
    total_issues: int = 0
    critical_issues: int = 0
    high_issues: int = 0
    medium_issues: int = 0
    low_issues: int = 0
    seo_health_score: Optional[float] = None
    category_scores: Dict[str, Any] = Field(default_factory=dict)
    site_signals: Dict[str, Any] = Field(default_factory=dict)
