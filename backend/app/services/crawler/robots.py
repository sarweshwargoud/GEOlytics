"""Robots.txt parser and AI crawler directive analyzer."""

import re
from typing import Dict, List, Optional, Set
from urllib.parse import urljoin, urlparse
import httpx

from app.services.crawler.models import AICrawlerDirective, RobotsTxtResult

# Well-known AI crawlers to inspect
AI_CRAWLERS = [
    "GPTBot",
    "OAI-SearchBot",
    "ChatGPT-User",
    "ClaudeBot",
    "anthropic-ai",
    "Claude-Web",
    "PerplexityBot",
    "Google-Extended",
    "CCBot",
    "Bytespider",
    "FacebookBot",
    "Meta-ExternalAgent",
]


class RobotsParser:
    """Parses robots.txt content, evaluating rules and AI bot directives."""

    def __init__(self, content: str = ""):
        self.raw_content = content
        self.sitemaps: List[str] = []
        self.user_agents: Dict[str, Dict[str, List[str]]] = {}
        self._parse()

    def _parse(self) -> None:
        current_agents: List[str] = []
        in_directive_block = False

        for line in self.raw_content.splitlines():
            line = line.strip()
            # Ignore comments and empty lines
            if not line or line.startswith("#"):
                continue

            if ":" not in line:
                continue

            field, _, value = line.partition(":")
            field = field.strip().lower()
            value = value.strip()

            if field == "user-agent":
                if in_directive_block:
                    current_agents = []
                    in_directive_block = False
                agent = value.lower()
                current_agents.append(agent)
                if agent not in self.user_agents:
                    self.user_agents[agent] = {"allow": [], "disallow": []}
            elif field == "disallow":
                in_directive_block = True
                for agent in current_agents:
                    if value:  # Empty disallow means allow all
                        self.user_agents[agent]["disallow"].append(value)
            elif field == "allow":
                in_directive_block = True
                for agent in current_agents:
                    if value:
                        self.user_agents[agent]["allow"].append(value)
            elif field == "sitemap":
                if value and value not in self.sitemaps:
                    self.sitemaps.append(value)

    def is_allowed(self, user_agent: str, path: str) -> bool:
        """
        Determines whether a given path is allowed for user_agent.
        Falls back to '*' if no specific agent matches.
        """
        agent_key = user_agent.lower()

        # Find best matching user-agent section
        rules = None
        for key in self.user_agents:
            if key in agent_key or agent_key in key:
                rules = self.user_agents[key]
                break

        if not rules:
            rules = self.user_agents.get("*", {"allow": [], "disallow": []})

        path = path or "/"

        # Check explicit disallows
        for disallowed in rules["disallow"]:
            if self._path_matches(disallowed, path):
                # Check if there is a more specific allow
                for allowed in rules["allow"]:
                    if self._path_matches(allowed, path) and len(allowed) >= len(disallowed):
                        return True
                return False

        return True

    def _path_matches(self, rule: str, path: str) -> bool:
        """Simple prefix match with wildcard support."""
        if rule == "/":
            return True
        pattern = re.escape(rule).replace(r"\*", ".*")
        return bool(re.match(f"^{pattern}", path))

    def analyze_ai_crawlers(self) -> List[AICrawlerDirective]:
        """Audits access rules for standard AI crawlers."""
        directives: List[AICrawlerDirective] = []

        wildcard_rules = self.user_agents.get("*", {"allow": [], "disallow": []})
        wildcard_blocks_root = "/" in wildcard_rules["disallow"]

        for crawler in AI_CRAWLERS:
            crawler_lower = crawler.lower()

            if crawler_lower in self.user_agents:
                rules = self.user_agents[crawler_lower]
                disallows = rules["disallow"]
                allows = rules["allow"]

                if "/" in disallows and "/" not in allows:
                    status = "blocked"
                    matched = "Disallow: /"
                elif disallows:
                    status = "blocked"
                    matched = f"Disallow: {disallows[0]}"
                elif allows:
                    status = "allowed"
                    matched = f"Allow: {allows[0]}"
                else:
                    status = "unrestricted"
                    matched = None
            else:
                if wildcard_blocks_root:
                    status = "blocked"
                    matched = "Inherited from User-agent: * (Disallow: /)"
                else:
                    status = "unrestricted"
                    matched = "No specific rule (inherits wildcard)"

            directives.append(
                AICrawlerDirective(
                    crawler_name=crawler,
                    status=status,
                    matched_rule=matched,
                )
            )

        return directives


async def fetch_and_parse_robots(base_url: str, client: httpx.AsyncClient) -> RobotsTxtResult:
    """Fetches /robots.txt from the website root and analyzes it."""
    parsed = urlparse(base_url)
    robots_url = f"{parsed.scheme}://{parsed.netloc}/robots.txt"

    try:
        response = await client.get(robots_url, timeout=10.0, follow_redirects=True)
        if response.status_code == 200:
            content = response.text
            parser = RobotsParser(content)
            ai_directives = parser.analyze_ai_crawlers()

            disallow_sample = []
            allow_sample = []
            for rules in parser.user_agents.values():
                disallow_sample.extend(rules["disallow"][:3])
                allow_sample.extend(rules["allow"][:3])

            return RobotsTxtResult(
                exists=True,
                url=robots_url,
                raw_content=content[:5000],  # cap stored content
                sitemaps=parser.sitemaps,
                disallow_rules=list(set(disallow_sample))[:10],
                allow_rules=list(set(allow_sample))[:10],
                ai_crawlers=ai_directives,
            )
        else:
            return RobotsTxtResult(exists=False, url=robots_url)
    except Exception:
        return RobotsTxtResult(exists=False, url=robots_url)
