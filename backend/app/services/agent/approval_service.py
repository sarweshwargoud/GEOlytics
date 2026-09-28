"""Approval and rejection workflow service for AI recommendations, with Hindsight memory feedback loops."""

import logging
from typing import Any, Dict, Optional
from fastapi import HTTPException, status

from app.core.database import get_supabase_admin
from app.services.agent.hindsight import HindsightMemoryService
from app.services.agent.models import MemoryModel, RecommendationOut

logger = logging.getLogger(__name__)


class RecommendationApprovalService:
    """Manages the human-in-the-loop review, approval, and rejection of AI recommendations."""

    @classmethod
    async def get_recommendation(cls, recommendation_id: str, user_id: str) -> Dict[str, Any]:
        """Retrieves a single recommendation ensuring user project ownership."""
        supabase = get_supabase_admin()
        res = (
            supabase.table("recommendations")
            .select("*, projects!inner(user_id)")
            .eq("id", recommendation_id)
            .eq("projects.user_id", user_id)
            .execute()
        )
        if not res.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Recommendation not found or unauthorized",
            )
        rec = res.data[0]
        rec.pop("projects", None)
        return rec

    @classmethod
    async def approve(cls, recommendation_id: str, user_id: str) -> Dict[str, Any]:
        """
        Approves a pending recommendation and stores an approval memory in Hindsight.
        """
        rec = await cls.get_recommendation(recommendation_id, user_id)
        project_id = rec["project_id"]

        supabase = get_supabase_admin()
        update_res = (
            supabase.table("recommendations")
            .update({
                "status": "approved",
                "requires_approval": False,
            })
            .eq("id", recommendation_id)
            .execute()
        )

        if not update_res.data:
            raise HTTPException(status_code=500, detail="Failed to update recommendation status")

        updated_rec = update_res.data[0]

        # ── Hindsight Memory Feedback Loop ─────────────────────────────
        hindsight = HindsightMemoryService()
        memory = MemoryModel(
            project_id=project_id,
            memory_type="strategy",
            category=rec.get("type", "content") if rec.get("type") in ("seo", "geo", "technical", "content") else "seo",
            title=f"Approved Strategy: {rec['title']}",
            content=(
                f"User approved recommendation '{rec['title']}'. "
                f"Action scheduled: {rec['action']}. "
                f"Suggested experiment: {rec['suggested_experiment']}. "
                f"Target criteria: {', '.join(rec.get('measurement_criteria', []))}."
            ),
            confidence=rec.get("confidence", 0.9),
            tags=["approved", rec.get("type", "general"), "experiment"],
            metadata={"recommendation_id": recommendation_id},
        )
        await hindsight.retain(project_id=project_id, memory=memory)
        logger.info("Recorded approval memory in Hindsight for recommendation %s", recommendation_id)

        return updated_rec

    @classmethod
    async def reject(cls, recommendation_id: str, reason: str, user_id: str) -> Dict[str, Any]:
        """
        Rejects a recommendation with a documented reason, logging the negative feedback into Hindsight.
        """
        rec = await cls.get_recommendation(recommendation_id, user_id)
        project_id = rec["project_id"]

        supabase = get_supabase_admin()
        update_res = (
            supabase.table("recommendations")
            .update({
                "status": "rejected",
                "rejection_reason": reason,
                "requires_approval": False,
            })
            .eq("id", recommendation_id)
            .execute()
        )

        if not update_res.data:
            raise HTTPException(status_code=500, detail="Failed to update recommendation status")

        updated_rec = update_res.data[0]

        # ── Hindsight Memory Feedback Loop ─────────────────────────────
        hindsight = HindsightMemoryService()
        memory = MemoryModel(
            project_id=project_id,
            memory_type="preference",
            category="approval",
            title=f"Rejected Recommendation: {rec['title']}",
            content=(
                f"User explicitly rejected recommendation '{rec['title']}'. "
                f"Action was: '{rec['action']}'. "
                f"User reason for rejection: '{reason}'. "
                "In future reasoning, avoid repeating similar recommendations for these pages."
            ),
            confidence=1.00,
            tags=["rejected", "preference", "user_constraint"],
            metadata={"recommendation_id": recommendation_id, "rejection_reason": reason},
        )
        await hindsight.retain(project_id=project_id, memory=memory)
        logger.info("Recorded rejection constraint in Hindsight for recommendation %s", recommendation_id)

        return updated_rec
