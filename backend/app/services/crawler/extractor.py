"""HTML extractor for SEO and technical signals using BeautifulSoup and Trafilatura."""

import json
import re
from typing import Any, Dict, List, Optional, Set, Tuple
from urllib.parse import urljoin, urlparse
from bs4 import BeautifulSoup
import trafilatura

from app.services.crawler.models import ImageData, LinkData, PageCrawlResult, SchemaData
from app.services.crawler.url_utils import is_same_domain, normalize_url, resolve_url


class HtmlExtractor:
    """Extracts on-page SEO, content structure, links, schema, and security signals from HTML."""

    @classmethod
    def extract(
        cls,
        html_content: str,
        current_url: str,
        final_url: Optional[str] = None,
        status_code: int = 200,
        response_time_ms: int = 0,
        content_type: str = "text/html",
    ) -> PageCrawlResult:
        final_url = final_url or current_url
        soup = BeautifulSoup(html_content, "html.parser")

        # ── 1. SEO Metadata ──────────────────────────────────────────
        title_tag = soup.find("title")
        title = title_tag.get_text().strip() if title_tag else None
        title_length = len(title) if title else 0

        meta_desc_tag = soup.find("meta", attrs={"name": re.compile(r"^description$", re.I)})
        meta_description = meta_desc_tag.get("content", "").strip() if meta_desc_tag else None
        meta_desc_length = len(meta_description) if meta_description else 0

        canonical_tag = soup.find("link", attrs={"rel": re.compile(r"^canonical$", re.I)})
        canonical = canonical_tag.get("href", "").strip() if canonical_tag else None
        if canonical:
            canonical = resolve_url(canonical, final_url)

        robots_meta_tag = soup.find("meta", attrs={"name": re.compile(r"^(robots|googlebot)$", re.I)})
        robots_meta = robots_meta_tag.get("content", "").strip() if robots_meta_tag else None

        # ── 2. Headings ──────────────────────────────────────────────
        h1_tags = [h.get_text().strip() for h in soup.find_all("h1") if h.get_text().strip()]
        primary_h1 = h1_tags[0] if h1_tags else None

        h2_data = [h.get_text().strip() for h in soup.find_all("h2") if h.get_text().strip()][:25]
        h3_data = [h.get_text().strip() for h in soup.find_all("h3") if h.get_text().strip()][:25]

        # ── 3. Content & Word Count ──────────────────────────────────
        # Try trafilatura first for clean main body text extraction
        extracted_text = trafilatura.extract(
            html_content,
            include_links=False,
            include_images=False,
            include_tables=True,
            no_fallback=False,
        )

        if not extracted_text:
            # Fallback: remove script, style, nav, footer, header from soup
            body = soup.find("body") or soup
            # Clone soup or clean directly
            for el in body(["script", "style", "nav", "footer", "header", "noscript", "svg"]):
                el.extract()
            extracted_text = body.get_text(separator=" ", strip=True)

        words = re.findall(r"\b\w+\b", extracted_text or "")
        word_count = len(words)

        # ── 4. Links ─────────────────────────────────────────────────
        internal_links: List[LinkData] = []
        external_links: List[LinkData] = []
        seen_links: Set[str] = set()

        for a in soup.find_all("a", href=True):
            href = a.get("href", "").strip()
            if not href or href.startswith(("#", "javascript:", "mailto:", "tel:")):
                continue

            resolved = resolve_url(href, final_url)
            if not resolved.startswith(("http://", "https://")):
                continue

            link_text = a.get_text().strip()
            link_key = f"{resolved}|{link_text}"
            if link_key in seen_links:
                continue
            seen_links.add(link_key)

            is_int = is_same_domain(resolved, final_url)
            link_obj = LinkData(url=resolved, text=link_text[:100], is_internal=is_int)
            if is_int:
                internal_links.append(link_obj)
            else:
                external_links.append(link_obj)

        # ── 5. Images ────────────────────────────────────────────────
        images_data: List[ImageData] = []
        missing_alt_count = 0

        for img in soup.find_all("img"):
            src = img.get("src") or img.get("data-src") or ""
            src = src.strip()
            if not src:
                continue

            resolved_src = resolve_url(src, final_url)
            alt = img.get("alt")
            is_missing_alt = alt is None or not alt.strip()

            if is_missing_alt:
                missing_alt_count += 1

            images_data.append(
                ImageData(
                    src=resolved_src,
                    alt=alt.strip() if alt else "",
                    missing_alt=is_missing_alt,
                )
            )

        # ── 6. Structured Data (JSON-LD) ─────────────────────────────
        schema_results: List[SchemaData] = []
        for script in soup.find_all("script", attrs={"type": "application/ld+json"}):
            raw_text = script.string or script.get_text() or ""
            raw_text = raw_text.strip()
            if not raw_text:
                continue

            try:
                parsed_json = json.loads(raw_text)
                types = cls._extract_schema_types(parsed_json)
                schema_results.append(
                    SchemaData(
                        raw_json=parsed_json if isinstance(parsed_json, dict) else {"items": parsed_json},
                        schema_types=types,
                        is_valid=True,
                    )
                )
            except Exception as e:
                schema_results.append(
                    SchemaData(
                        raw_json=None,
                        schema_types=[],
                        is_valid=False,
                        error_message=f"JSON-LD syntax error: {str(e)[:150]}",
                    )
                )

        # ── 7. Security (HTTPS & Mixed Content) ──────────────────────
        is_https = final_url.startswith("https://")
        mixed_content: List[str] = []

        if is_https:
            # Check for HTTP assets embedded on HTTPS page
            for tag, attr in [("img", "src"), ("script", "src"), ("link", "href"), ("iframe", "src")]:
                for el in soup.find_all(tag, attrs={attr: True}):
                    res_val = (el.get(attr) or "").strip()
                    if res_val.startswith("http://"):
                        mixed_content.append(f"{tag}[{attr}]: {res_val[:120]}")

        return PageCrawlResult(
            url=current_url,
            final_url=final_url,
            status_code=status_code,
            response_time_ms=response_time_ms,
            content_type=content_type,
            title=title,
            title_length=title_length,
            meta_description=meta_description,
            meta_description_length=meta_desc_length,
            canonical=canonical,
            robots_meta=robots_meta,
            h1=primary_h1,
            h1_list=h1_tags,
            h2_data=h2_data,
            h3_data=h3_data,
            word_count=word_count,
            main_text=(extracted_text[:2000] if extracted_text else None),  # Cap stored preview
            internal_links=internal_links,
            external_links=external_links,
            image_count=len(images_data),
            missing_alt_count=missing_alt_count,
            images_data=images_data[:50],  # cap per page
            schema_data=schema_results,
            is_https=is_https,
            mixed_content=mixed_content[:10],
        )

    @staticmethod
    def _extract_schema_types(data: Any) -> List[str]:
        """Recursively extracts @type fields from schema.org objects."""
        types: List[str] = []
        if isinstance(data, dict):
            if "@type" in data:
                val = data["@type"]
                if isinstance(val, list):
                    types.extend([str(t) for t in val])
                elif isinstance(val, str):
                    types.append(val)
            for v in data.values():
                types.extend(HtmlExtractor._extract_schema_types(v))
        elif isinstance(data, list):
            for item in data:
                types.extend(HtmlExtractor._extract_schema_types(item))
        return list(dict.fromkeys(types))
