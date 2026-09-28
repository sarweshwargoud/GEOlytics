"""Crawler package exports."""

from app.services.crawler.crawler import WebsiteCrawler
from app.services.crawler.extractor import HtmlExtractor
from app.services.crawler.models import (
    AICrawlerDirective,
    CrawlOptions,
    ImageData,
    LinkData,
    PageCrawlResult,
    RobotsTxtResult,
    SchemaData,
    SiteSignalsResult,
    SitemapResult,
)
from app.services.crawler.robots import RobotsParser, fetch_and_parse_robots
from app.services.crawler.sitemap import SitemapParser, discover_and_parse_sitemap
from app.services.crawler.url_utils import is_same_domain, is_safe_url, normalize_url, resolve_url

__all__ = [
    "WebsiteCrawler",
    "HtmlExtractor",
    "CrawlOptions",
    "PageCrawlResult",
    "LinkData",
    "ImageData",
    "SchemaData",
    "RobotsTxtResult",
    "SitemapResult",
    "SiteSignalsResult",
    "AICrawlerDirective",
    "RobotsParser",
    "fetch_and_parse_robots",
    "SitemapParser",
    "discover_and_parse_sitemap",
    "is_safe_url",
    "is_same_domain",
    "normalize_url",
    "resolve_url",
]
