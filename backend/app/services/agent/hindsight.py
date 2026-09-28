"""Hindsight Long-Term Memory Service.

Provides agent memory persistence, semantic recall, reflection, and feedback loops
for SEO and GEO strategies. Connects to Hindsight Cloud/API when configured,
with persistent database synchronization in Supabase.
"""

import logging
from typing import Any, Dict, List, Optional
import httpx

from app.core.config import get_settings
from app.core.database import get_supabase_admin
from app.services.agent.models import MemoryCategory, MemoryModel, MemoryType

logger = logging.getLogger(__name__)


# Standard baseline memories seeded for new projects to provide initial intelligence
BASELINE_MEMORIES = [
    {
        "memory_type": "strategy",
        "category": "geo",
        "title": "Comparison Tables & Direct FAQ Citability",
        "content": "Structuring content with clear comparison matrices and direct Q&A answers significantly improved observable citation presence across Gemini and OpenAI search groundings.",
        "confidence": 0.95,
        "tags": ["geo", "citations", "faq", "comparison"],
    },
    {
        "memory_type": "strategy",
        "category": "seo",
        "title": "Structured Data & Schema Coverage",
        "content": "Implementing JSON-LD (FAQPage, TechArticle, Organization) helped search engines identify key entities and increased organic CTR on informative landing pages.",
        "confidence": 0.90,
        "tags": ["seo", "schema", "ctr", "entities"],
    },
    {
        "memory_type": "lesson_learned",
        "category": "seo",
        "title": "Keyword Stuffing Ineffectiveness",
        "content": "Solely increasing keyword density without adding original data, citations, or unique value produced zero measurable ranking improvements and increased bounce rates.",
        "confidence": 0.95,
        "tags": ["seo", "content", "caution"],
    },
    {
        "memory_type": "preference",
        "category": "approval",
        "title": "Human-in-the-Loop Approval Required",
        "content": "User policy strictly requires explicit review and approval before any recommendation is scheduled or implemented. Never assume automatic approval.",
        "confidence": 1.00,
        "tags": ["policy", "approval", "human_in_the_loop"],
    },
]


class HindsightMemoryService:
    """Manages persistent memory retention, recall, and reflection for AI agents."""

    def __init__(self, api_key: Optional[str] = None, base_url: Optional[str] = None):
        settings = get_settings()
        self.api_key = api_key if api_key is not None else settings.hindsight_api_key
        self.base_url = (base_url or settings.hindsight_base_url or "https://api.hindsight.vectorize.io").rstrip("/")

    def is_configured(self) -> bool:
        """Returns True if Hindsight Cloud API credentials are provided."""
        return bool(self.api_key and len(self.api_key.strip()) > 5)

    async def retain(
        self,
        project_id: str,
        memory: MemoryModel,
        access_token: Optional[str] = None,
    ) -> MemoryModel:
        """
        Retains a new experience or lesson in long-term memory.
        Persists to both Hindsight Cloud (if configured) and Supabase database.
        """
        # 1. Forward to Hindsight API if configured
        if self.is_configured():
            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    headers = {
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json",
                    }
                    payload = {
                        "project_id": project_id,
                        "title": memory.title,
                        "content": memory.content,
                        "category": memory.category,
                        "memory_type": memory.memory_type,
                        "confidence": memory.confidence,
                        "tags": memory.tags,
                        "metadata": memory.metadata,
                    }
                    resp = await client.post(
                        f"{self.base_url}/v1/memories",
                        json=payload,
                        headers=headers,
                    )
                    if resp.is_success:
                        logger.info("Successfully retained memory in Hindsight Cloud for project %s", project_id)
            except Exception as e:
                logger.warning("Hindsight Cloud retain call failed (continuing with local persistence): %s", e)

        # 2. Persist in Supabase agent_memories
        supabase = get_supabase_admin()
        row = {
            "project_id": project_id,
            "memory_type": memory.memory_type,
            "category": memory.category,
            "title": memory.title,
            "content": memory.content,
            "source": memory.source,
            "confidence": memory.confidence,
            "tags": memory.tags,
            "metadata": memory.metadata,
        }

        try:
            res = supabase.table("agent_memories").insert(row).execute()
            if res.data:
                memory.id = res.data[0]["id"]
                memory.created_at = res.data[0]["created_at"]
        except Exception as e:
            logger.error("Failed to persist memory to Supabase: %s", e)

        return memory

    async def recall(
        self,
        project_id: str,
        query_context: str,
        category: Optional[str] = None,
        limit: int = 5,
    ) -> List[MemoryModel]:
        """
        Recalls memories relevant to the current problem or topic.
        Queries Hindsight Cloud if available, with robust database search fallback.
        """
        memories: List[MemoryModel] = []

        # 1. Attempt Hindsight Cloud semantic search if configured
        if self.is_configured():
            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    headers = {
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json",
                    }
                    params = {
                        "project_id": project_id,
                        "query": query_context,
                        "limit": limit,
                    }
                    if category:
                        params["category"] = category

                    resp = await client.get(
                        f"{self.base_url}/v1/recall",
                        params=params,
                        headers=headers,
                    )
                    if resp.is_success:
                        data = resp.json()
                        for item in data.get("memories", []):
                            memories.append(
                                MemoryModel(
                                    id=item.get("id"),
                                    project_id=project_id,
                                    memory_type=item.get("memory_type", "strategy"),
                                    category=item.get("category", "seo"),
                                    title=item.get("title", ""),
                                    content=item.get("content", ""),
                                    confidence=item.get("confidence", 0.9),
                                    tags=item.get("tags", []),
                                    metadata=item.get("metadata", {}),
                                )
                            )
                        if memories:
                            return memories[:limit]
            except Exception as e:
                logger.warning("Hindsight Cloud recall failed, falling back to local database: %s", e)

        # 2. Database query fallback
        await self.seed_baseline_memories_if_empty(project_id)
        supabase = get_supabase_admin()

        query = (
            supabase.table("agent_memories")
            .select("*")
            .eq("project_id", project_id)
        )
        if category:
            query = query.eq("category", category)

        res = query.order("confidence", desc=True).limit(limit * 2).execute()
        raw_items = res.data or []

        # Simple keyword ranking against query context
        context_words = set(query_context.lower().split())
        scored_items = []

        for item in raw_items:
            text = (item["title"] + " " + item["content"] + " " + " ".join(item.get("tags", []))).lower()
            score = sum(1 for w in context_words if len(w) > 3 and w in text)
            scored_items.append((score, item))

        scored_items.sort(key=lambda x: x[0], reverse=True)

        for _, item in scored_items[:limit]:
            memories.append(
                MemoryModel(
                    id=item["id"],
                    project_id=project_id,
                    memory_type=item["memory_type"],
                    category=item["category"],
                    title=item["title"],
                    content=item["content"],
                    source=item.get("source", "agent_reflection"),
                    confidence=float(item.get("confidence", 1.0)),
                    tags=item.get("tags", []),
                    metadata=item.get("metadata", {}),
                    created_at=item.get("created_at"),
                )
            )

        return memories

    async def reflect(
        self,
        project_id: str,
        topic: str,
    ) -> str:
        """
        Synthesizes historical lessons and memories on a topic into a concise guidance summary.
        """
        recalled = await self.recall(project_id=project_id, query_context=topic, limit=4)
        if not recalled:
            return "No previous historical experiments or preferences recorded for this topic."

        bullets = []
        for m in recalled:
            prefix = "✓" if m.memory_type in ("strategy", "outcome") else "⚠"
            bullets.append(f"{prefix} [{m.category.upper()}] {m.title}: {m.content}")

        return "\n".join(bullets)

    async def seed_baseline_memories_if_empty(self, project_id: str) -> None:
        """Ensures a project has foundational SEO/GEO baseline learning if no records exist."""
        supabase = get_supabase_admin()
        res = (
            supabase.table("agent_memories")
            .select("id")
            .eq("project_id", project_id)
            .limit(1)
            .execute()
        )
        if not res.data:
            logger.info("Seeding baseline agent memories for project %s", project_id)
            rows = []
            for b in BASELINE_MEMORIES:
                rows.append({
                    "project_id": project_id,
                    "memory_type": b["memory_type"],
                    "category": b["category"],
                    "title": b["title"],
                    "content": b["content"],
                    "confidence": b["confidence"],
                    "tags": b["tags"],
                    "source": "system_baseline",
                })
            try:
                supabase.table("agent_memories").insert(rows).execute()
            except Exception as e:
                logger.error("Failed to seed baseline memories: %s", e)
