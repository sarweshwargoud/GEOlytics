"""Sitemap discovery and XML parsing service."""

import xml.etree.ElementTree as ET
from typing import List, Optional, Set
from urllib.parse import urlparse
import httpx

from app.services.crawler.models import SitemapResult
from app.services.crawler.url_utils import is_same_domain, normalize_url

XML_NAMESPACES = {
    "sm": "http://www.sitemaps.org/schemas/sitemap/0.9",
}


class SitemapParser:
    """Parses XML sitemaps and sitemap index files."""

    @staticmethod
    def parse_sitemap_xml(xml_content: str, base_domain: str, max_urls: int = 200) -> tuple[List[str], bool, List[str]]:
        """
        Parses XML string into a list of URLs.
        Returns: (urls, has_lastmod, child_sitemaps)
        """
        urls: List[str] = []
        child_sitemaps: List[str] = []
        has_lastmod = False

        try:
            # Strip XML declaration if present to avoid encoding issues
            clean_xml = xml_content.strip()
            root = ET.fromstring(clean_xml)
        except Exception:
            return urls, has_lastmod, child_sitemaps

        # Clean tag helper (strip namespace {http...})
        def clean_tag(t: str) -> str:
            return t.split("}")[-1] if "}" in t else t

        root_tag = clean_tag(root.tag).lower()

        # Case 1: Sitemap index (<sitemapindex>)
        if root_tag == "sitemapindex":
            for sitemap_node in root:
                if clean_tag(sitemap_node.tag).lower() == "sitemap":
                    for child in sitemap_node:
                        if clean_tag(child.tag).lower() == "loc" and child.text:
                            loc = child.text.strip()
                            if is_same_domain(loc, base_domain):
                                child_sitemaps.append(loc)

        # Case 2: Standard URL set (<urlset>)
        elif root_tag == "urlset":
            for url_node in root:
                if clean_tag(url_node.tag).lower() == "url":
                    loc_val = None
                    for child in url_node:
                        tag = clean_tag(child.tag).lower()
                        if tag == "loc" and child.text:
                            loc_val = child.text.strip()
                        elif tag == "lastmod" and child.text:
                            has_lastmod = True

                    if loc_val and is_same_domain(loc_val, base_domain):
                        norm = normalize_url(loc_val)
                        if norm not in urls:
                            urls.append(norm)
                            if len(urls) >= max_urls:
                                break

        return urls, has_lastmod, child_sitemaps


async def discover_and_parse_sitemap(
    base_url: str,
    robots_sitemaps: Optional[List[str]] = None,
    client: Optional[httpx.AsyncClient] = None,
    max_urls: int = 100,
) -> SitemapResult:
    """Discovers sitemaps from robots.txt or /sitemap.xml and parses entries."""
    parsed = urlparse(base_url)
    default_sitemap = f"{parsed.scheme}://{parsed.netloc}/sitemap.xml"

    candidate_sitemaps: List[str] = []
    if robots_sitemaps:
        candidate_sitemaps.extend(robots_sitemaps)
    if default_sitemap not in candidate_sitemaps:
        candidate_sitemaps.append(default_sitemap)

    owns_client = False
    if client is None:
        client = httpx.AsyncClient(timeout=10.0, follow_redirects=True)
        owns_client = True

    try:
        discovered_urls: List[str] = []
        any_lastmod = False
        valid_sitemap_url = None
        errors: List[str] = []

        for sm_url in candidate_sitemaps:
            try:
                resp = await client.get(sm_url, timeout=10.0, follow_redirects=True)
                if resp.status_code == 200 and ("xml" in resp.headers.get("content-type", "") or "xml" in resp.text[:100]):
                    valid_sitemap_url = sm_url
                    urls, has_lastmod, child_sms = SitemapParser.parse_sitemap_xml(
                        resp.text, base_domain=parsed.netloc, max_urls=max_urls
                    )
                    discovered_urls.extend(urls)
                    if has_lastmod:
                        any_lastmod = True

                    # If it was an index, fetch up to 2 child sitemaps
                    for child_sm in child_sms[:2]:
                        try:
                            child_resp = await client.get(child_sm, timeout=10.0, follow_redirects=True)
                            if child_resp.status_code == 200:
                                c_urls, c_has_lm, _ = SitemapParser.parse_sitemap_xml(
                                    child_resp.text, base_domain=parsed.netloc, max_urls=max_urls - len(discovered_urls)
                                )
                                discovered_urls.extend(c_urls)
                                if c_has_lm:
                                    any_lastmod = True
                        except Exception as e:
                            errors.append(f"Failed to fetch child sitemap {child_sm}: {str(e)}")

                    if discovered_urls or valid_sitemap_url:
                        break
            except Exception as e:
                errors.append(f"Failed to fetch sitemap at {sm_url}: {str(e)}")

        # Deduplicate
        unique_urls = list(dict.fromkeys(discovered_urls))

        return SitemapResult(
            exists=valid_sitemap_url is not None,
            url=valid_sitemap_url,
            url_count=len(unique_urls),
            urls_sample=unique_urls[:20],
            has_lastmod=any_lastmod,
            errors=errors[:5],
        )

    finally:
        if owns_client:
            await client.aclose()
