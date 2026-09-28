"""URL utilities for crawler safety, SSRF protection, normalization, and domain scoping."""

import ipaddress
import socket
from typing import Tuple
from urllib.parse import parse_qsl, urlencode, urljoin, urlparse, urlunparse

# Disallowed query parameters (tracking, sessions, cache busters)
TRACKING_PARAMS = {
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
    "gclid",
    "fbclid",
    "msclkid",
    "mc_cid",
    "mc_eid",
    "_ga",
    "_gl",
}

# Blocked hostnames
BLOCKED_HOSTNAMES = {
    "localhost",
    "127.0.0.1",
    "::1",
    "0.0.0.0",
    "local",
    "broadcasthost",
}


def is_safe_url(url: str) -> Tuple[bool, str]:
    """
    Validates that a URL is safe to fetch (prevents SSRF and non-HTTP protocols).
    Returns (is_safe, error_reason).
    """
    if not url or not isinstance(url, str):
        return False, "URL is empty or invalid"

    try:
        parsed = urlparse(url.strip())
    except Exception as e:
        return False, f"Malformed URL: {str(e)}"

    # Scheme check: only http and https are permitted
    if parsed.scheme.lower() not in ("http", "https"):
        return False, f"Disallowed scheme: '{parsed.scheme}'. Only http and https are allowed."

    hostname = (parsed.hostname or "").lower().strip()
    if not hostname:
        return False, "URL is missing hostname"

    # Blocked hostname check
    if hostname in BLOCKED_HOSTNAMES or hostname.endswith(".local") or hostname.endswith(".internal"):
        return False, f"Access to private/internal host '{hostname}' is forbidden."

    # IP address validation (prevent SSRF to private/link-local/loopback addresses)
    try:
        # Check if the hostname is a raw IP literal
        ip = ipaddress.ip_address(hostname)
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_multicast or ip.is_reserved:
            return False, f"Access to private IP range '{ip}' is blocked."
    except ValueError:
        # Hostname is a domain name, not a raw IP
        pass

    return True, ""


def normalize_url(url: str) -> str:
    """
    Normalizes a URL:
    - Lowercases scheme and host
    - Strips fragment (#...)
    - Strips common tracking parameters (utm_*, gclid, fbclid)
    - Sorts query parameters
    - Normalizes trailing slashes (preserves '/' for root, strips for deeper paths)
    """
    try:
        parsed = urlparse(url.strip())
    except Exception:
        return url

    scheme = parsed.scheme.lower()
    netloc = parsed.netloc.lower()

    # Filter tracking params
    query_params = parse_qsl(parsed.query, keep_blank_values=True)
    filtered_params = [
        (k, v) for k, v in query_params if k.lower() not in TRACKING_PARAMS
    ]
    filtered_params.sort(key=lambda x: x[0])
    query = urlencode(filtered_params)

    path = parsed.path or "/"
    # Clean redundant duplicate slashes
    while "//" in path:
        path = path.replace("//", "/")

    # Strip trailing slash if path is longer than '/'
    if len(path) > 1 and path.endswith("/"):
        path = path[:-1]

    return urlunparse((scheme, netloc, path, parsed.params, query, ""))


def get_base_domain(url: str) -> str:
    """Extracts the registered domain or host from a URL."""
    try:
        parsed = urlparse(url.strip())
        host = (parsed.hostname or "").lower()
        if host.startswith("www."):
            host = host[4:]
        return host
    except Exception:
        return ""


def is_same_domain(target_url: str, base_url_or_domain: str) -> bool:
    """
    Determines if target_url belongs to the same domain as base_url_or_domain.
    Permits www and non-www as equivalent.
    """
    try:
        target_host = urlparse(target_url).hostname or ""
        target_host = target_host.lower()
        if target_host.startswith("www."):
            target_host = target_host[4:]

        if "://" in base_url_or_domain:
            base_host = urlparse(base_url_or_domain).hostname or ""
        else:
            base_host = base_url_or_domain

        base_host = base_host.lower()
        if base_host.startswith("www."):
            base_host = base_host[4:]

        return target_host == base_host or target_host.endswith("." + base_host)
    except Exception:
        return False


def resolve_url(relative_url: str, base_url: str) -> str:
    """Safely joins a relative URL with a base URL."""
    try:
        joined = urljoin(base_url, relative_url.strip())
        return normalize_url(joined)
    except Exception:
        return relative_url
