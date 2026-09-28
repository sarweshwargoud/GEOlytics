"""Website crawler orchestrator enforcing limits, SSRF protection, politeness, and extraction."""

import asyncio
from collections import deque
import logging
import time
from typing import Callable, Deque, Dict, List, Optional, Set, Tuple
from urllib.parse import urlparse
import httpx

from app.services.crawler.extractor import HtmlExtractor
from app.services.crawler.models import (
    CrawlOptions,
    PageCrawlResult,
    RobotsTxtResult,
    SiteSignalsResult,
    SitemapResult,
)
from app.services.crawler.robots import RobotsParser, fetch_and_parse_robots
from app.services.crawler.sitemap import discover_and_parse_sitemap
from app.services.crawler.url_utils import (
    get_base_domain,
    is_same_domain,
    is_safe_url,
    normalize_url,
)

logger = logging.getLogger(__name__)


class WebsiteCrawler:
    """Safe, modular website crawler with robots.txt awareness and structured signal extraction."""

    def __init__(self, base_url: str, options: Optional[CrawlOptions] = None):
        self.raw_base_url = base_url.strip()
        self.options = options or CrawlOptions()
        self.base_domain = get_base_domain(self.raw_base_url)
        self.normalized_start_url = normalize_url(self.raw_base_url)

    async def check_llms_txt(self, client: httpx.AsyncClient) -> Tuple[bool, Optional[str], bool]:
        """Checks for /llms.txt and /llms-full.txt files at the root."""
        parsed = urlparse(self.raw_base_url)
        llms_url = f"{parsed.scheme}://{parsed.netloc}/llms.txt"
        llms_full_url = f"{parsed.scheme}://{parsed.netloc}/llms-full.txt"

        has_llms = False
        has_llms_full = False

        try:
            r1 = await client.get(llms_url, timeout=5.0, follow_redirects=True)
            if r1.status_code == 200 and len(r1.text.strip()) > 10:
                has_llms = True
        except Exception:
            pass

        try:
            r2 = await client.get(llms_full_url, timeout=5.0, follow_redirects=True)
            if r2.status_code == 200 and len(r2.text.strip()) > 10:
                has_llms_full = True
        except Exception:
            pass

        return has_llms, (llms_url if has_llms else None), has_llms_full

    async def crawl(
        self,
        progress_callback: Optional[Callable[[int, int, str], None]] = None,
    ) -> Tuple[List[PageCrawlResult], SiteSignalsResult, int, int]:
        """
        Executes the crawl.
        Returns: (crawled_pages, site_signals, pages_crawled_count, pages_failed_count)
        """
        # Step 0: SSRF and URL validation
        safe, reason = is_safe_url(self.raw_base_url)
        if not safe:
            raise ValueError(f"Target URL is disallowed: {reason}")

        crawled_pages: List[PageCrawlResult] = []
        visited_urls: Set[str] = set()
        queue: Deque[Tuple[str, int]] = deque([(self.normalized_start_url, 0)])
        pages_failed_count = 0

        headers = {
            "User-Agent": self.options.user_agent,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
        }

        async with httpx.AsyncClient(
            headers=headers,
            timeout=self.options.timeout_seconds,
            follow_redirects=True,
            verify=False,  # Allow sites with self-signed dev certificates to be audited
        ) as client:
            # Step 1: Robots.txt discovery & analysis
            robots_result = await fetch_and_parse_robots(self.raw_base_url, client)
            robots_parser = RobotsParser(robots_result.raw_content or "")

            # Step 2: llms.txt discovery
            has_llms, llms_url, has_llms_full = await self.check_llms_txt(client)

            # Step 3: Sitemap discovery
            sitemap_result = await discover_and_parse_sitemap(
                self.raw_base_url,
                robots_sitemaps=robots_result.sitemaps,
                client=client,
                max_urls=self.options.max_pages,
            )

            # Seed queue with top URLs from sitemap if available (up to 10 priority URLs)
            for sm_url in sitemap_result.urls_sample[:10]:
                norm_sm = normalize_url(sm_url)
                if norm_sm != self.normalized_start_url:
                    queue.append((norm_sm, 1))

            site_signals = SiteSignalsResult(
                robots_txt=robots_result,
                sitemap=sitemap_result,
                llms_txt_exists=has_llms,
                llms_txt_url=llms_url,
                llms_full_txt_exists=has_llms_full,
            )

            # Step 4: BFS Crawl Loop
            while queue and len(crawled_pages) < self.options.max_pages:
                current_url, depth = queue.popleft()
                norm_url = normalize_url(current_url)

                if norm_url in visited_urls:
                    continue
                visited_urls.add(norm_url)

                # SSRF check per URL
                is_safe, _ = is_safe_url(norm_url)
                if not is_safe:
                    continue

                # Same domain check
                if not is_same_domain(norm_url, self.base_domain):
                    continue

                # Check robots.txt permissions
                parsed_path = urlparse(norm_url).path
                if not robots_parser.is_allowed(self.options.user_agent, parsed_path):
                    logger.info(f"Skipping {norm_url} due to robots.txt disallow rule")
                    continue

                # Politeness delay
                if self.options.delay_seconds > 0 and len(crawled_pages) > 0:
                    await asyncio.sleep(self.options.delay_seconds)

                # Fetch page
                start_time = time.perf_counter()
                try:
                    response = await client.get(norm_url)
                    elapsed_ms = int((time.perf_counter() - start_time) * 1000)
                    content_type = response.headers.get("content-type", "").lower()

                    final_url = str(response.url)
                    status_code = response.status_code

                    # Only extract HTML documents
                    if "text/html" not in content_type and "application/xhtml" not in content_type:
                        page_res = PageCrawlResult(
                            url=norm_url,
                            final_url=final_url,
                            status_code=status_code,
                            response_time_ms=elapsed_ms,
                            content_type=content_type,
                            title=None,
                            error=f"Non-HTML content type: {content_type}",
                        )
                        crawled_pages.append(page_res)
                        continue

                    # Extract page signals
                    page_res = HtmlExtractor.extract(
                        html_content=response.text,
                        current_url=norm_url,
                        final_url=final_url,
                        status_code=status_code,
                        response_time_ms=elapsed_ms,
                        content_type=content_type,
                    )
                    crawled_pages.append(page_res)

                    if progress_callback:
                        progress_callback(len(crawled_pages), self.options.max_pages, norm_url)

                    # Add discovered internal links to queue if within max_depth
                    if depth < self.options.max_depth:
                        for link in page_res.internal_links:
                            norm_link = normalize_url(link.url)
                            if norm_link not in visited_urls and is_same_domain(norm_link, self.base_domain):
                                queue.append((norm_link, depth + 1))

                except httpx.TimeoutException:
                    pages_failed_count += 1
                    crawled_pages.append(
                        PageCrawlResult(
                            url=norm_url,
                            status_code=0,
                            response_time_ms=int(self.options.timeout_seconds * 1000),
                            error="Request timed out",
                        )
                    )
                except Exception as e:
                    pages_failed_count += 1
                    crawled_pages.append(
                        PageCrawlResult(
                            url=norm_url,
                            status_code=0,
                            response_time_ms=0,
                            error=f"Fetch failed: {str(e)[:150]}",
                        )
                    )

        return crawled_pages, site_signals, len(crawled_pages), pages_failed_count
