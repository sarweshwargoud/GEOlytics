"""Pydantic schemas for closed-loop SEO & GEO experiment tracking."""

from datetime import datetime
from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field

ExperimentStatus = Literal[
    "draft",
    "approved",
    "baseline_captured",
    "implementation_pending",
    "running",
    "measuring",
    "completed",
    "cancelled",
]

ExperimentOutcome = Literal[
    "pending",
    "positive",
    "neutral",
    "negative",
    "inconclusive",
    "insufficient_data",
]


class SuccessCriterion(BaseModel):
    metric: str = Field(..., description="Metric key: 'clicks', 'impressions', 'ctr', 'position', 'ai_citations', 'brand_mentions'")
    target_type: str = Field("min_improvement", description="'min_improvement', 'no_drop', 'positive_delta', 'increase'")
    target_value: float = Field(0.0, description="Target numeric value or threshold percentage")
    description: str = Field(..., description="Human-readable description of this criterion")


class ExperimentCreate(BaseModel):
    recommendation_id: Optional[str] = None
    name: str = Field(..., min_length=3, max_length=255)
    hypothesis: str = Field(..., min_length=10)
    measurement_window_days: int = Field(14, ge=3, le=90, description="Measurement window duration in days (e.g. 7, 14, 28)")
    affected_pages: List[str] = Field(default_factory=list)
    affected_queries: List[str] = Field(default_factory=list)
    success_criteria: List[SuccessCriterion] = Field(default_factory=list)
    notes: Optional[str] = None


class ExperimentUpdate(BaseModel):
    name: Optional[str] = None
    hypothesis: Optional[str] = None
    status: Optional[ExperimentStatus] = None
    notes: Optional[str] = None
    measurement_window_days: Optional[int] = None
    success_criteria: Optional[List[SuccessCriterion]] = None


class ImplementationConfirmRequest(BaseModel):
    implementation_date: Optional[str] = Field(None, description="ISO timestamp of when the change was implemented. Defaults to now.")
    implementation_notes: Optional[str] = Field(None, description="Summary of what was changed on the website.")


class CompleteExperimentRequest(BaseModel):
    forced_outcome: Optional[ExperimentOutcome] = None
    final_notes: Optional[str] = None


class SEOMetricSnapshot(BaseModel):
    clicks: int = 0
    impressions: int = 0
    ctr: float = 0.0
    position: float = 0.0
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    available: bool = False


class GEOMetricSnapshot(BaseModel):
    observed_citations: int = 0
    observed_mentions: int = 0
    tested_queries_count: int = 0
    provider_breakdown: Dict[str, Dict[str, Any]] = Field(default_factory=dict)
    query_details: List[Dict[str, Any]] = Field(default_factory=list)
    available: bool = False


class PeriodSnapshot(BaseModel):
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    days: int = 14
    seo: SEOMetricSnapshot = Field(default_factory=SEOMetricSnapshot)
    geo: GEOMetricSnapshot = Field(default_factory=GEOMetricSnapshot)


class MetricDeltaItem(BaseModel):
    metric: str
    baseline: float
    after: float
    absolute_delta: float
    percent_delta: Optional[float] = None
    pp_delta: Optional[float] = None
    position_improvement: Optional[float] = None
    status: Literal["improved", "neutral", "regressed", "no_data"] = "no_data"
    formatted_display: str


class ExperimentResult(BaseModel):
    deltas: Dict[str, Any] = Field(default_factory=dict)
    metric_items: List[MetricDeltaItem] = Field(default_factory=list)
    criteria_evaluations: List[Dict[str, Any]] = Field(default_factory=list)
    outcome: ExperimentOutcome = "pending"
    outcome_summary: str = ""
    evidence: List[str] = Field(default_factory=list)
    limitations: List[str] = Field(default_factory=list)
    hindsight_memory_retained: Optional[str] = None


class ExperimentOut(BaseModel):
    id: str
    project_id: str
    recommendation_id: Optional[str] = None
    name: str
    hypothesis: str
    status: ExperimentStatus
    start_date: Optional[str] = None
    implementation_date: Optional[str] = None
    measurement_start: Optional[str] = None
    measurement_end: Optional[str] = None
    baseline_period: Dict[str, Any] = Field(default_factory=dict)
    target_period: Dict[str, Any] = Field(default_factory=dict)
    success_criteria: List[Dict[str, Any]] = Field(default_factory=list)
    metrics: List[Dict[str, Any]] = Field(default_factory=list)
    result: Dict[str, Any] = Field(default_factory=dict)
    outcome: ExperimentOutcome
    notes: Optional[str] = None
    created_at: str
    updated_at: str
    completed_at: Optional[str] = None
