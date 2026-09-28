"""Data models for website crawler and extraction results."""

from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class CrawlOptions(BaseModel):
    """Configuration options for website crawling."""

    max_pages: int = Field(default=25, ge=1, le=100, description="Maximum pages to crawl")
    max_depth: int = Field(default=3, ge=1, le=10, description="Maximum crawl depth from root")
    timeout_seconds: float = Field(default=15.0, ge=3.0, le=60.0, description="Per-request timeout")
    delay_seconds: float = Field(default=0.3, ge=0.0, le=5.0, description="Politeness delay between requests")
    user_agent: str = Field(
        default="SEO-GEO-Intelligence-Bot/1.0 (+https://seo-ai.local)",
        description="Custom user agent string",
    )


class LinkData(BaseModel):
    url: str
    text: str = ""
    is_internal: bool = True


class ImageData(BaseModel):
    src: str
    alt: str = ""
    missing_alt: bool = False


class SchemaData(BaseModel):
    raw_json: Optional[Dict[str, Any]] = None
    schema_types: List[str] = Field(default_factory=list)
    is_valid: bool = True
    error_message: Optional[str] = None


class PageCrawlResult(BaseModel):
    """Complete extraction result for a single crawled page."""

    url: str
    final_url: Optional[str] = None
    status_code: int = 0
    response_time_ms: int = 0
    content_type: str = "text/html"

    # SEO metadata
    title: Optional[str] = None
    title_length: int = 0
    meta_description: Optional[str] = None
    meta_description_length: int = 0
    canonical: Optional[str] = None
    robots_meta: Optional[str] = None

    # Headings
    h1: Optional[str] = None
    h1_list: List[str] = Field(default_factory=list)
    h2_data: List[str] = Field(default_factory=list)
    h3_data: List[str] = Field(default_factory=list)

    # Content
    word_count: int = 0
    main_text: Optional[str] = None

    # Links
    internal_links: List[LinkData] = Field(default_factory=list)
    external_links: List[LinkData] = Field(default_factory=list)

    # Images
    image_count: int = 0
    missing_alt_count: int = 0
    images_data: List[ImageData] = Field(default_factory=list)

    # Structured Data
    schema_data: List[SchemaData] = Field(default_factory=list)

    # Security
    is_https: bool = True
    mixed_content: List[str] = Field(default_factory=list)

    # Status / Errors
    crawled_at: datetime = Field(default_factory=datetime.utcnow)
    error: Optional[str] = None


class AICrawlerDirective(BaseModel):
    crawler_name: str
    status: str  # "allowed", "blocked", "unrestricted"
    matched_rule: Optional[str] = None


class RobotsTxtResult(BaseModel):
    exists: bool = False
    url: Optional[str] = None
    raw_content: Optional[str] = None
    sitemaps: List[str] = Field(default_factory=list)
    disallow_rules: List[str] = Field(default_factory=list)
    allow_rules: List[str] = Field(default_factory=list)
    ai_crawlers: List[AICrawlerDirective] = Field(default_factory=list)


class SitemapResult(BaseModel):
    exists: bool = False
    url: Optional[str] = None
    url_count: int = 0
    urls_sample: List[str] = Field(default_factory=list)
    has_lastmod: bool = False
    errors: List[str] = Field(default_factory=list)


class SiteSignalsResult(BaseModel):
    robots_txt: RobotsTxtResult = Field(default_factory=RobotsTxtResult)
    sitemap: SitemapResult = Field(default_factory=SitemapResult)
    llms_txt_exists: bool = False
    llms_txt_url: Optional[str] = None
    llms_full_txt_exists: bool = False
