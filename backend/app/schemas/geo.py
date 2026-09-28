"""Schemas for GEO intelligence, tracked queries, and visibility check endpoints."""

from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field
from app.services.geo.models import NormalizedAIResponse, ProviderCapability, QueryVisibilitySummary


class TrackedQueryCreate(BaseModel):
    query: str = Field(..., min_length=2, max_length=300)
    category: str = Field(default="general", max_length=50)
    target_entity: Optional[str] = Field(default=None, max_length=100)


class TrackedQueryOut(BaseModel):
    id: str
    project_id: str
    query: str
    category: str
    target_entity: Optional[str] = None
    enabled: bool = True
    created_at: str
    updated_at: str
    latest_visibility: Optional[Dict[str, Any]] = None


class VisibilityCheckTrigger(BaseModel):
    query_id: str
    competitor_domains: Optional[List[str]] = None


class ProviderStatusResponse(BaseModel):
    providers: List[ProviderCapability]


class CompetitorResearchRequest(BaseModel):
    query: str
    competitor_domains: Optional[List[str]] = None
