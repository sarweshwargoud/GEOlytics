"""Request/response schemas for the API."""

from pydantic import BaseModel, HttpUrl
from typing import Optional
from datetime import datetime


# ─── Projects ────────────────────────────────────────────────────

class ProjectCreate(BaseModel):
    name: str
    website_url: str
    industry: Optional[str] = None
    target_location: str = "Global"
    language: str = "en"


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    website_url: Optional[str] = None
    industry: Optional[str] = None
    target_location: Optional[str] = None
    language: Optional[str] = None


class ProjectOut(BaseModel):
    id: str
    user_id: str
    name: str
    website_url: str
    industry: Optional[str]
    target_location: str
    language: str
    created_at: str
    updated_at: str


class ProjectListOut(BaseModel):
    projects: list[ProjectOut]
    count: int


# ─── Health ──────────────────────────────────────────────────────

class HealthOut(BaseModel):
    status: str
    service: str
    version: str
    database: Optional[str] = None
    services: Optional[dict] = None


# ─── Scoring type stubs (architecture only — not scored in Phase 1) ─

class SEOScoreBreakdown(BaseModel):
    """Architecture stub for the SEO Health Index (0-100).

    This is a diagnostic heuristic, NOT an official Google metric
    or ranking probability.
    """
    crawlability: Optional[int] = None   # 0-30
    technical: Optional[int] = None      # 0-25
    on_page: Optional[int] = None        # 0-20
    content: Optional[int] = None        # 0-15
    authority: Optional[int] = None      # 0-10
    total: Optional[int] = None          # 0-100


class GEOScoreBreakdown(BaseModel):
    """Architecture stub for the GEO Readiness Score (0-100).

    This is a diagnostic heuristic, NOT an official AI-platform
    citation probability.
    """
    platform_readiness: Optional[int] = None   # 0-25
    content_citability: Optional[int] = None   # 0-25
    technical_foundation: Optional[int] = None # 0-20
    schema_structured: Optional[int] = None    # 0-15
    entity_presence: Optional[int] = None      # 0-15
    total: Optional[int] = None                # 0-100
