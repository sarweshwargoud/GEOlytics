"""Unit tests for crawler safety, extraction, robots.txt, sitemaps, and SEO scoring."""

import pytest
from app.services.crawler.url_utils import is_safe_url, is_same_domain, normalize_url, resolve_url
from app.services.crawler.robots import RobotsParser
from app.services.crawler.sitemap import SitemapParser
from app.services.crawler.extractor import HtmlExtractor
from app.services.analyzer.rules import AuditRulesEvaluator
from app.services.analyzer.scorer import SEOScorer
from app.services.analyzer.models import IssueSeverity, IssueCategory
from app.services.crawler.models import PageCrawlResult, SiteSignalsResult, RobotsTxtResult, SitemapResult


# ─── URL Safety & SSRF Tests ─────────────────────────────────

def test_ssrf_blocks_private_ips_and_localhost():
    assert is_safe_url("http://localhost:8000")[0] is False
    assert is_safe_url("http://127.0.0.1/admin")[0] is False
    assert is_safe_url("http://10.0.0.1/secret")[0] is False
    assert is_safe_url("http://192.168.1.1/")[0] is False
    assert is_safe_url("http://172.16.0.5/api")[0] is False
    assert is_safe_url("file:///etc/passwd")[0] is False
    assert is_safe_url("ftp://example.com")[0] is False


def test_ssrf_allows_public_urls():
    assert is_safe_url("https://example.com")[0] is True
    assert is_safe_url("https://subdomain.google.com/search?q=test")[0] is True


def test_url_normalization():
    url = "HTTPS://Example.COM/blog/?utm_source=twitter&utm_medium=social#heading"
    normalized = normalize_url(url)
    assert normalized == "https://example.com/blog"


def test_same_domain_check():
    assert is_same_domain("https://example.com/about", "https://example.com") is True
    assert is_same_domain("https://www.example.com/about", "example.com") is True
    assert is_same_domain("https://blog.example.com", "example.com") is True
    assert is_same_domain("https://evil.com", "example.com") is False


# ─── Robots.txt & AI Crawler Tests ───────────────────────────

def test_robots_parser_ai_crawlers():
    robots_content = """
User-agent: *
Disallow: /admin/
Allow: /

User-agent: GPTBot
Disallow: /

User-agent: ClaudeBot
Allow: /public/
Disallow: /private/

Sitemap: https://example.com/sitemap.xml
"""
    parser = RobotsParser(robots_content)
    assert len(parser.sitemaps) == 1
    assert parser.sitemaps[0] == "https://example.com/sitemap.xml"

    # Rule checks
    assert parser.is_allowed("Googlebot", "/admin/test") is False
    assert parser.is_allowed("Googlebot", "/blog") is True

    # AI crawler directive audit
    ai_directives = parser.analyze_ai_crawlers()
    gpt_directive = next((d for d in ai_directives if d.crawler_name == "GPTBot"), None)
    claude_directive = next((d for d in ai_directives if d.crawler_name == "ClaudeBot"), None)
    perplexity_directive = next((d for d in ai_directives if d.crawler_name == "PerplexityBot"), None)

    assert gpt_directive is not None
    assert gpt_directive.status == "blocked"
    assert claude_directive is not None
    assert perplexity_directive is not None
    assert perplexity_directive.status == "unrestricted"


# ─── Sitemap Parser Tests ────────────────────────────────────

def test_sitemap_xml_parsing():
    xml = """<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://example.com/</loc>
    <lastmod>2026-01-01</lastmod>
  </url>
  <url>
    <loc>https://example.com/about</loc>
  </url>
  <url>
    <loc>https://external.com/page</loc>
  </url>
</urlset>
"""
    urls, has_lastmod, child_sms = SitemapParser.parse_sitemap_xml(xml, base_domain="example.com")
    assert len(urls) == 2
    assert "https://example.com" in urls or "https://example.com/" in urls
    assert "https://example.com/about" in urls
    assert has_lastmod is True


# ─── HTML Extraction Tests ───────────────────────────────────

def test_html_extraction():
    html = """<!DOCTYPE html>
<html>
<head>
  <title>Complete Guide to SEO Optimization</title>
  <meta name="description" content="Discover actionable technical and on-page SEO strategies to boost search engine and AI search visibility.">
  <link rel="canonical" href="https://example.com/guide">
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": "SEO Guide"
  }
  </script>
</head>
<body>
  <h1>Mastering SEO in 2026</h1>
  <h2>Technical Foundations</h2>
  <p>Here is an in-depth article explaining modern search optimization techniques for business websites.</p>
  <a href="/contact">Get in touch</a>
  <a href="https://other.com">External reference</a>
  <img src="/logo.png" alt="Company Logo">
  <img src="/banner.png">
</body>
</html>
"""
    res = HtmlExtractor.extract(html, current_url="https://example.com/guide")
    assert res.title == "Complete Guide to SEO Optimization"
    assert res.title_length == len("Complete Guide to SEO Optimization")
    assert res.meta_description is not None
    assert res.canonical == "https://example.com/guide"
    assert res.h1 == "Mastering SEO in 2026"
    assert len(res.h2_data) == 1
    assert len(res.internal_links) == 1
    assert len(res.external_links) == 1
    assert res.image_count == 2
    assert res.missing_alt_count == 1
    assert len(res.schema_data) == 1
    assert res.schema_data[0].schema_types == ["Article"]


# ─── SEO Audit Rules & Scorer Tests ──────────────────────────

def test_audit_rules_detection_and_scoring():
    # Page with multiple violations
    bad_page = PageCrawlResult(
        url="http://example.com",  # Insecure HTTP
        status_code=200,
        title=None,                # Missing title
        h1=None,                   # Missing H1
        word_count=50,             # Thin content
        image_count=3,
        missing_alt_count=3,       # Missing alt text
        is_https=False,
    )

    signals = SiteSignalsResult(
        robots_txt=RobotsTxtResult(exists=False),
        sitemap=SitemapResult(exists=False),
        llms_txt_exists=False,
    )

    issues = AuditRulesEvaluator.evaluate_all([bad_page], signals)
    assert len(issues) > 0

    severities = [i.severity for i in issues]
    assert IssueSeverity.CRITICAL in severities or IssueSeverity.HIGH in severities

    score, cat_scores = SEOScorer.calculate_scores(issues, pages_count=1)
    # Score should be lower than 100 due to severe issues
    assert score < 85.0
    assert cat_scores.on_page < 100.0
    assert cat_scores.technical < 100.0
