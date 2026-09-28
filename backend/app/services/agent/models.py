"""Data models and schemas for LangGraph intelligence pipeline, recommendations, and agent memory."""

from datetime import datetime
from typing import Any, Dict, List, Literal, Optional, TypedDict
from pydantic import BaseModel, Field


RecommendationType = Literal[
    "content",
    "technical",
    "schema",
    "linking",
    "geo_visibility",
    "metadata",
]

RecommendationPriority = Literal["critical", "high", "medium", "low"]

RecommendationStatus = Literal[
    "pending",
    "approved",
    "rejected",
    "experiment_created",
    "implemented",
    "measuring",
    "completed",
    "cancelled",
]

MemoryType = Literal[
    "strategy",
    "outcome",
    "preference",
    "competitor_observation",
    "lesson_learned",
]

MemoryCategory = Literal["seo", "geo", "technical", "content", "approval"]


# ── Pydantic Recommendation Models ───────────────────────────────────────────

class RecommendationModel(BaseModel):
    id: Optional[str] = None
    project_id: str
    title: str = Field(..., min_length=5, max_length=250)
    type: RecommendationType
    priority: RecommendationPriority
    action: str = Field(..., min_length=10)
    reason: str = Field(..., min_length=10)
    hypothesis: str = Field(..., min_length=10)
    confidence: float = Field(default=0.85, ge=0.0, le=1.0)
    status: RecommendationStatus = "pending"
    evidence: List[str] = Field(default_factory=list)
    affected_pages: List[str] = Field(default_factory=list)
    affected_queries: List[str] = Field(default_factory=list)
    geo_observations: List[Dict[str, Any]] = Field(default_factory=list)
    competitor_observations: List[Dict[str, Any]] = Field(default_factory=list)
    historical_memory: List[str] = Field(default_factory=list)
    suggested_experiment: str = Field(..., min_length=10)
    measurement_criteria: List[str] = Field(default_factory=list)
    requires_approval: bool = True
    rejection_reason: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class RecommendationOut(BaseModel):
    id: str
    project_id: str
    title: str
    type: str
    priority: str
    action: str
    reason: str
    hypothesis: str
    confidence: float
    status: str
    evidence: List[str]
    affected_pages: List[str]
    affected_queries: List[str]
    geo_observations: List[Dict[str, Any]]
    competitor_observations: List[Dict[str, Any]]
    historical_memory: List[str]
    suggested_experiment: str
    measurement_criteria: List[str]
    requires_approval: bool
    rejection_reason: Optional[str] = None
    created_at: str
    updated_at: str


class RecommendationRejectRequest(BaseModel):
    reason: str = Field(..., min_length=3, max_length=500)


# ── Pydantic Memory Models ───────────────────────────────────────────────────

class MemoryModel(BaseModel):
    id: Optional[str] = None
    project_id: str
    memory_type: MemoryType
    category: MemoryCategory
    title: str = Field(..., min_length=3, max_length=200)
    content: str = Field(..., min_length=5)
    source: str = "agent_reflection"
    confidence: float = Field(default=1.0, ge=0.0, le=1.0)
    tags: List[str] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)
    created_at: Optional[str] = None


class MemoryOut(BaseModel):
    id: str
    project_id: str
    memory_type: str
    category: str
    title: str
    content: str
    source: str
    confidence: float
    tags: List[str]
    metadata: Dict[str, Any]
    created_at: str


class AgentRunResponse(BaseModel):
    project_id: str
    recommendations_generated: int
    recommendations: List[RecommendationOut]
    memories_recalled: int
    execution_time_seconds: float
    summary: str


# ── LangGraph State Definition ────────────────────────────────────────────────

class LangGraphAgentState(TypedDict, total=False):
    # Context
    project_id: str
    project_name: str
    website_url: str
    target_brand: str
    user_access_token: Optional[str]

    # Data collection
    collected_seo: Dict[str, Any]
    collected_geo: Dict[str, Any]

    # Analysis
    seo_analysis: Dict[str, Any]
    geo_analysis: Dict[str, Any]
    competitor_research: List[Dict[str, Any]]

    # Long-term memory
    recalled_memories: List[Dict[str, Any]]

    # Reasoning & Generation
    reasoning_synthesis: Dict[str, Any]
    raw_recommendations: List[Dict[str, Any]]
    validated_recommendations: List[Dict[str, Any]]
    saved_recommendations: List[Dict[str, Any]]

    # Execution telemetry
    errors: List[str]
    execution_log: List[str]
