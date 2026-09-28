"""Individual SEO audit rule evaluators covering Technical, On-Page, Content, Links, and GEO signals."""

from collections import Counter
from typing import List, Set
from app.services.analyzer.models import IssueCategory, IssueSeverity, SEOIssue
from app.services.crawler.models import PageCrawlResult, SiteSignalsResult


class AuditRulesEvaluator:
    """Evaluates crawled pages and site signals against SEO and technical criteria."""

    @classmethod
    def evaluate_all(
        cls,
        pages: List[PageCrawlResult],
        site_signals: SiteSignalsResult,
    ) -> List[SEOIssue]:
        issues: List[SEOIssue] = []

        if not pages:
            issues.append(
                SEOIssue(
                    category=IssueCategory.TECHNICAL,
                    severity=IssueSeverity.CRITICAL,
                    issue="No pages were successfully crawled",
                    evidence="Crawl yielded 0 accessible pages.",
                    recommendation="Verify that the website URL is accessible and server firewall allows requests.",
                )
            )
            return issues

        # 1. Page-level evaluations
        for page in pages:
            issues.extend(cls._evaluate_page_status(page))
            issues.extend(cls._evaluate_page_titles(page))
            issues.extend(cls._evaluate_page_meta(page))
            issues.extend(cls._evaluate_page_headings(page))
            issues.extend(cls._evaluate_page_canonical(page))
            issues.extend(cls._evaluate_page_images(page))
            issues.extend(cls._evaluate_page_content(page))
            issues.extend(cls._evaluate_page_schema(page))
            issues.extend(cls._evaluate_page_security(page))

        # 2. Site-wide duplicate and cross-page evaluations
        issues.extend(cls._evaluate_duplicates(pages))
        issues.extend(cls._evaluate_broken_internal_links(pages))

        # 3. Site-level signals (Robots.txt, Sitemap, llms.txt, AI crawler accessibility)
        issues.extend(cls._evaluate_site_signals(site_signals))

        return issues

    @classmethod
    def _evaluate_page_status(cls, page: PageCrawlResult) -> List[SEOIssue]:
        issues = []
        if page.error:
            issues.append(
                SEOIssue(
                    category=IssueCategory.TECHNICAL,
                    severity=IssueSeverity.CRITICAL,
                    issue="Page failed to load or timed out",
                    affected_url=page.url,
                    evidence=f"Error encountered: {page.error}",
                    recommendation="Ensure the server responds promptly without connection drops or timeouts.",
                )
            )
        elif page.status_code >= 500:
            issues.append(
                SEOIssue(
                    category=IssueCategory.TECHNICAL,
                    severity=IssueSeverity.CRITICAL,
                    issue=f"Server returned HTTP {page.status_code} error",
                    affected_url=page.url,
                    evidence=f"Status code {page.status_code}",
                    recommendation="Investigate server logs and backend application code to resolve internal server errors.",
                )
            )
        elif page.status_code >= 400:
            issues.append(
                SEOIssue(
                    category=IssueCategory.TECHNICAL,
                    severity=IssueSeverity.HIGH,
                    issue=f"Client error HTTP {page.status_code} on crawled URL",
                    affected_url=page.url,
                    evidence=f"Status code {page.status_code}",
                    recommendation="Fix broken links pointing to this URL or configure an appropriate 301 redirect.",
                )
            )

        if page.response_time_ms > 2000:
            issues.append(
                SEOIssue(
                    category=IssueCategory.TECHNICAL,
                    severity=IssueSeverity.MEDIUM,
                    issue="Slow server response time (>2000ms)",
                    affected_url=page.url,
                    evidence=f"Time to First Byte / Response: {page.response_time_ms}ms",
                    recommendation="Optimize database queries, enable server-side caching, or use a CDN to reduce TTFB.",
                )
            )
        return issues

    @classmethod
    def _evaluate_page_titles(cls, page: PageCrawlResult) -> List[SEOIssue]:
        issues = []
        if page.status_code != 200:
            return issues

        if not page.title:
            issues.append(
                SEOIssue(
                    category=IssueCategory.ON_PAGE,
                    severity=IssueSeverity.CRITICAL,
                    issue="Missing <title> tag",
                    affected_url=page.url,
                    evidence="Page has no HTML title element.",
                    recommendation="Add a descriptive, unique <title> tag between 30 and 60 characters.",
                )
            )
        elif page.title_length < 25:
            issues.append(
                SEOIssue(
                    category=IssueCategory.ON_PAGE,
                    severity=IssueSeverity.LOW,
                    issue="Title tag is overly short (<25 characters)",
                    affected_url=page.url,
                    evidence=f"Title: '{page.title}' ({page.title_length} chars)",
                    recommendation="Expand the title tag to provide clearer context for users and search engines (recommended: 30-60 chars).",
                )
            )
        elif page.title_length > 65:
            issues.append(
                SEOIssue(
                    category=IssueCategory.ON_PAGE,
                    severity=IssueSeverity.LOW,
                    issue="Title tag exceeds recommended length (>65 characters)",
                    affected_url=page.url,
                    evidence=f"Title length: {page.title_length} characters",
                    recommendation="Shorten title to ~50-60 characters to avoid truncation in search engine result pages.",
                )
            )
        return issues

    @classmethod
    def _evaluate_page_meta(cls, page: PageCrawlResult) -> List[SEOIssue]:
        issues = []
        if page.status_code != 200:
            return issues

        if not page.meta_description:
            issues.append(
                SEOIssue(
                    category=IssueCategory.ON_PAGE,
                    severity=IssueSeverity.MEDIUM,
                    issue="Missing meta description tag",
                    affected_url=page.url,
                    evidence="No <meta name='description'> found.",
                    recommendation="Add a concise, compelling meta description summarizing the page content (70-160 characters).",
                )
            )
        elif page.meta_description_length < 60:
            issues.append(
                SEOIssue(
                    category=IssueCategory.ON_PAGE,
                    severity=IssueSeverity.LOW,
                    issue="Meta description is very short (<60 characters)",
                    affected_url=page.url,
                    evidence=f"Meta description: '{page.meta_description}' ({page.meta_description_length} chars)",
                    recommendation="Expand the meta description to ~120-160 characters with relevant contextual details.",
                )
            )
        elif page.meta_description_length > 170:
            issues.append(
                SEOIssue(
                    category=IssueCategory.ON_PAGE,
                    severity=IssueSeverity.LOW,
                    issue="Meta description exceeds 170 characters",
                    affected_url=page.url,
                    evidence=f"Length: {page.meta_description_length} characters",
                    recommendation="Trim meta description to under 160 characters to prevent snippet ellipsis truncation.",
                )
            )

        if page.robots_meta and "noindex" in page.robots_meta.lower():
            issues.append(
                SEOIssue(
                    category=IssueCategory.INDEXABILITY,
                    severity=IssueSeverity.HIGH,
                    issue="Page contains 'noindex' directive",
                    affected_url=page.url,
                    evidence=f"meta robots='{page.robots_meta}'",
                    recommendation="If this page is intended for public search indexing, remove the noindex directive.",
                )
            )
        return issues

    @classmethod
    def _evaluate_page_headings(cls, page: PageCrawlResult) -> List[SEOIssue]:
        issues = []
        if page.status_code != 200:
            return issues

        if not page.h1:
            issues.append(
                SEOIssue(
                    category=IssueCategory.ON_PAGE,
                    severity=IssueSeverity.HIGH,
                    issue="Missing <h1> heading tag",
                    affected_url=page.url,
                    evidence="No <h1> tag was found in the document.",
                    recommendation="Include exactly one prominent <h1> tag that describes the page's core topic.",
                )
            )
        elif len(page.h1_list) > 1:
            issues.append(
                SEOIssue(
                    category=IssueCategory.ON_PAGE,
                    severity=IssueSeverity.MEDIUM,
                    issue=f"Multiple <h1> headings found ({len(page.h1_list)})",
                    affected_url=page.url,
                    evidence=f"H1 tags: {', '.join(page.h1_list[:3])}",
                    recommendation="Use a single primary <h1> per page to maintain clear topical hierarchy; demote secondary headers to <h2>.",
                )
            )

        # Heading hierarchy jump check (H1 to H3 without H2)
        if page.h1 and page.h3_data and not page.h2_data:
            issues.append(
                SEOIssue(
                    category=IssueCategory.ON_PAGE,
                    severity=IssueSeverity.LOW,
                    issue="Heading hierarchy skips level (<h3> used without <h2>)",
                    affected_url=page.url,
                    evidence=f"Document contains <h3> tags but zero <h2> tags.",
                    recommendation="Maintain logical heading progression (h1 -> h2 -> h3) for accessibility and clarity.",
                )
            )
        return issues

    @classmethod
    def _evaluate_page_canonical(cls, page: PageCrawlResult) -> List[SEOIssue]:
        issues = []
        if page.status_code != 200:
            return issues

        if not page.canonical:
            issues.append(
                SEOIssue(
                    category=IssueCategory.INDEXABILITY,
                    severity=IssueSeverity.MEDIUM,
                    issue="Missing canonical tag (<link rel='canonical'>)",
                    affected_url=page.url,
                    evidence="No canonical link tag specified.",
                    recommendation="Add a self-referential or master canonical tag to prevent duplicate content ambiguity.",
                )
            )
        return issues

    @classmethod
    def _evaluate_page_images(cls, page: PageCrawlResult) -> List[SEOIssue]:
        issues = []
        if page.missing_alt_count > 0:
            pct = int((page.missing_alt_count / max(1, page.image_count)) * 100)
            issues.append(
                SEOIssue(
                    category=IssueCategory.ON_PAGE,
                    severity=IssueSeverity.MEDIUM if pct > 30 else IssueSeverity.LOW,
                    issue=f"{page.missing_alt_count} image(s) missing alt attribute",
                    affected_url=page.url,
                    evidence=f"{page.missing_alt_count} out of {page.image_count} images ({pct}%) lack alt text.",
                    recommendation="Provide descriptive alt text for images to enhance accessibility, image search, and machine understanding.",
                )
            )
        return issues

    @classmethod
    def _evaluate_page_content(cls, page: PageCrawlResult) -> List[SEOIssue]:
        issues = []
        if page.status_code != 200:
            return issues

        if page.word_count < 150:
            issues.append(
                SEOIssue(
                    category=IssueCategory.CONTENT,
                    severity=IssueSeverity.MEDIUM,
                    issue="Thin content detected (<150 words)",
                    affected_url=page.url,
                    evidence=f"Extracted main text contains only {page.word_count} words.",
                    recommendation="Enrich page with substantive, helpful content that comprehensively answers user queries.",
                )
            )
        return issues

    @classmethod
    def _evaluate_page_schema(cls, page: PageCrawlResult) -> List[SEOIssue]:
        issues = []
        if page.status_code != 200:
            return issues

        # Check for malformed JSON-LD
        for s in page.schema_data:
            if not s.is_valid:
                issues.append(
                    SEOIssue(
                        category=IssueCategory.STRUCTURED_DATA,
                        severity=IssueSeverity.HIGH,
                        issue="Malformed JSON-LD structured data",
                        affected_url=page.url,
                        evidence=s.error_message or "JSON parsing error in <script type='application/ld+json'>",
                        recommendation="Validate and correct syntax errors in the JSON-LD script block.",
                    )
                )

        if not page.schema_data:
            issues.append(
                SEOIssue(
                    category=IssueCategory.STRUCTURED_DATA,
                    severity=IssueSeverity.LOW,
                    issue="No JSON-LD structured data detected",
                    affected_url=page.url,
                    evidence="Page does not provide any schema.org JSON-LD markup.",
                    recommendation="Implement relevant Schema.org structured data (e.g. WebSite, Organization, Article, Product) to assist search and AI engines in entity extraction.",
                )
            )
        return issues

    @classmethod
    def _evaluate_page_security(cls, page: PageCrawlResult) -> List[SEOIssue]:
        issues = []
        if not page.is_https:
            issues.append(
                SEOIssue(
                    category=IssueCategory.SECURITY,
                    severity=IssueSeverity.HIGH,
                    issue="Page served over insecure HTTP instead of HTTPS",
                    affected_url=page.url,
                    evidence=f"URL scheme is http: {page.url}",
                    recommendation="Migrate to HTTPS and enforce an automatic 301 redirect from HTTP to HTTPS.",
                )
            )
        elif page.mixed_content:
            issues.append(
                SEOIssue(
                    category=IssueCategory.SECURITY,
                    severity=IssueSeverity.MEDIUM,
                    issue="Mixed content detected (insecure HTTP resources loaded over HTTPS)",
                    affected_url=page.url,
                    evidence=f"Insecure assets: {', '.join(page.mixed_content[:3])}",
                    recommendation="Update asset URLs to use https:// or relative paths to avoid browser security blocking.",
                )
            )
        return issues

    @classmethod
    def _evaluate_duplicates(cls, pages: List[PageCrawlResult]) -> List[SEOIssue]:
        issues = []
        valid_pages = [p for p in pages if p.status_code == 200]

        # Duplicate titles
        title_counts = Counter(p.title for p in valid_pages if p.title)
        for title, count in title_counts.items():
            if count > 1:
                dup_urls = [p.url for p in valid_pages if p.title == title]
                issues.append(
                    SEOIssue(
                        category=IssueCategory.ON_PAGE,
                        severity=IssueSeverity.HIGH,
                        issue=f"Duplicate title tag shared across {count} pages",
                        affected_url=dup_urls[0],
                        evidence=f"Title '{title[:60]}' appears on: {', '.join(dup_urls[:3])}",
                        recommendation="Ensure each page has a unique, topic-specific title to avoid keyword cannibalization.",
                    )
                )

        # Duplicate meta descriptions
        desc_counts = Counter(p.meta_description for p in valid_pages if p.meta_description)
        for desc, count in desc_counts.items():
            if count > 1:
                dup_urls = [p.url for p in valid_pages if p.meta_description == desc]
                issues.append(
                    SEOIssue(
                        category=IssueCategory.ON_PAGE,
                        severity=IssueSeverity.MEDIUM,
                        issue=f"Duplicate meta description shared across {count} pages",
                        affected_url=dup_urls[0],
                        evidence=f"Meta description appears on: {', '.join(dup_urls[:3])}",
                        recommendation="Craft custom meta descriptions for each individual page.",
                    )
                )

        return issues

    @classmethod
    def _evaluate_broken_internal_links(cls, pages: List[PageCrawlResult]) -> List[SEOIssue]:
        issues = []
        status_by_url = {p.url: p.status_code for p in pages}

        # Check internal links that failed or returned 4xx/5xx
        for page in pages:
            for link in page.internal_links:
                dest_status = status_by_url.get(link.url)
                if dest_status and dest_status >= 400:
                    issues.append(
                        SEOIssue(
                            category=IssueCategory.LINKS,
                            severity=IssueSeverity.HIGH,
                            issue=f"Broken internal link (HTTP {dest_status})",
                            affected_url=page.url,
                            evidence=f"Link to '{link.url}' returned HTTP {dest_status} (Anchor: '{link.text}').",
                            recommendation="Update or remove broken internal links to prevent crawl budget waste and bad user experience.",
                        )
                    )
        return issues

    @classmethod
    def _evaluate_site_signals(cls, signals: SiteSignalsResult) -> List[SEOIssue]:
        issues = []

        # 1. Robots.txt
        if not signals.robots_txt.exists:
            issues.append(
                SEOIssue(
                    category=IssueCategory.INDEXABILITY,
                    severity=IssueSeverity.MEDIUM,
                    issue="No robots.txt file found at website root",
                    evidence="HTTP request for /robots.txt failed or returned non-200.",
                    recommendation="Create a valid /robots.txt file to guide search engine and AI crawlers.",
                )
            )

        # 2. Sitemap
        if not signals.sitemap.exists:
            issues.append(
                SEOIssue(
                    category=IssueCategory.INDEXABILITY,
                    severity=IssueSeverity.MEDIUM,
                    issue="No XML sitemap found or referenced",
                    evidence="Could not locate /sitemap.xml or Sitemap declaration in robots.txt.",
                    recommendation="Generate an XML sitemap and reference it inside /robots.txt for faster indexation.",
                )
            )

        # 3. AI Crawler Directives (GEO Technical Signal)
        blocked_ai_bots = [d.crawler_name for d in signals.robots_txt.ai_crawlers if d.status == "blocked"]
        if blocked_ai_bots:
            issues.append(
                SEOIssue(
                    category=IssueCategory.INDEXABILITY,
                    severity=IssueSeverity.LOW,
                    issue=f"Robots.txt blocks AI search crawlers ({len(blocked_ai_bots)} detected)",
                    evidence=f"Blocked bots: {', '.join(blocked_ai_bots[:5])}",
                    recommendation="If your strategy includes visibility in AI answer engines (ChatGPT, Claude, Perplexity), allow AI crawlers in /robots.txt.",
                )
            )

        # 4. llms.txt Presence (GEO Technical Signal)
        if not signals.llms_txt_exists:
            issues.append(
                SEOIssue(
                    category=IssueCategory.STRUCTURED_DATA,
                    severity=IssueSeverity.LOW,
                    issue="No /llms.txt file detected (AI context file)",
                    evidence="Request for /llms.txt returned 404 or empty.",
                    recommendation="Consider adding an /llms.txt file to provide structured, markdown-first documentation for LLMs and AI search bots.",
                )
            )

        return issues
