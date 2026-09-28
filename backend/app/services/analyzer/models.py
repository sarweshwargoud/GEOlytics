"""Data models for SEO audit issues, category breakdowns, and health scoring."""

from enum import Enum
from typing import Dict, List, Optional
from pydantic import BaseModel, Field


class IssueSeverity(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class IssueCategory(str, Enum):
    TECHNICAL = "technical"
    ON_PAGE = "on_page"
    INDEXABILITY = "indexability"
    CONTENT = "content"
    LINKS = "links"
    STRUCTURED_DATA = "structured_data"
    SECURITY = "security"


class SEOIssue(BaseModel):
    """A detected SEO or technical issue with evidence and actionable recommendation."""

    category: IssueCategory
    severity: IssueSeverity
    issue: str
    affected_url: Optional[str] = None
    evidence: Optional[str] = None
    recommendation: str
    page_id: Optional[str] = None


class CategoryScores(BaseModel):
    technical: float = 100.0
    on_page: float = 100.0
    indexability: float = 100.0
    content: float = 100.0
    links: float = 100.0
    structured_data: float = 100.0


class AuditSummary(BaseModel):
    """Complete SEO audit result with overall score, category breakdown, and issues."""

    seo_health_score: float = Field(
        ...,
        ge=0.0,
        le=100.0,
        description="Diagnostic health index (0-100). NOT an official Google ranking score.",
    )
    category_scores: CategoryScores
    total_issues: int = 0
    critical_issues: int = 0
    high_issues: int = 0
    medium_issues: int = 0
    low_issues: int = 0
    issues: List[SEOIssue] = Field(default_factory=list)
