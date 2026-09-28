"""Data models and schemas for automation jobs, scheduling, reports, notifications, and health."""

from datetime import datetime
from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field

JobType = Literal[
    "seo_sync",
    "geo_checks",
    "seo_audit",
    "competitor_research",
    "agent_analysis",
    "experiment_measurement",
    "report_generation",
]

JobFrequency = Literal["hourly", "daily", "weekly", "monthly"]

JobStatus = Literal[
    "queued",
    "running",
    "completed",
    "partial_success",
    "failed",
    "skipped",
]

NotificationCategory = Literal[
    "recommendation",
    "experiment",
    "geo_change",
    "report",
    "system",
]


class AutomationJobSetting(BaseModel):
    id: Optional[str] = None
    project_id: str
    job_type: JobType
    enabled: bool = True
    frequency: JobFrequency = "daily"
    last_run_at: Optional[str] = None
    next_run_at: Optional[str] = None
    configuration: Dict[str, Any] = Field(default_factory=dict)
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class AutomationJobSettingUpdate(BaseModel):
    enabled: Optional[bool] = None
    frequency: Optional[JobFrequency] = None
    configuration: Optional[Dict[str, Any]] = None


class AutomationRunLog(BaseModel):
    id: str
    project_id: str
    job_type: JobType
    status: JobStatus
    started_at: str
    completed_at: Optional[str] = None
    duration_seconds: float = 0.0
    result_summary: Optional[str] = None
    error_message: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)
    created_at: str


class ManualRunRequest(BaseModel):
    force: bool = False
    parameters: Dict[str, Any] = Field(default_factory=dict)


# ── Report Models ─────────────────────────────────────────────────────────────

class ReportSectionData(BaseModel):
    title: str
    summary: str
    metrics: Dict[str, Any] = Field(default_factory=dict)
    items: List[Dict[str, Any]] = Field(default_factory=list)


class ReportDataPayload(BaseModel):
    executive_summary: str
    seo_performance: Dict[str, Any] = Field(default_factory=dict)
    geo_visibility: Dict[str, Any] = Field(default_factory=dict)
    competitor_insights: Dict[str, Any] = Field(default_factory=dict)
    recommendations: Dict[str, Any] = Field(default_factory=dict)
    experiments: Dict[str, Any] = Field(default_factory=dict)
    hindsight_learnings: List[Dict[str, Any]] = Field(default_factory=list)
    limitations: List[str] = Field(default_factory=list)
    data_freshness: Dict[str, Any] = Field(default_factory=dict)


class ReportOut(BaseModel):
    id: str
    project_id: str
    report_type: str
    period_start: str
    period_end: str
    status: str
    summary: Optional[str] = None
    data: Dict[str, Any] = Field(default_factory=dict)
    created_at: str


class GenerateReportRequest(BaseModel):
    period_days: int = Field(7, ge=1, le=90)
    report_type: str = "weekly"


# ── Notification Models ───────────────────────────────────────────────────────

class NotificationOut(BaseModel):
    id: str
    project_id: str
    user_id: str
    category: NotificationCategory
    title: str
    message: str
    is_read: bool
    related_entity_id: Optional[str] = None
    related_entity_type: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)
    created_at: str


class NotificationPreferencesModel(BaseModel):
    id: Optional[str] = None
    project_id: str
    user_id: str
    high_priority_recs: bool = True
    experiment_results: bool = True
    geo_visibility_changes: bool = True
    weekly_reports: bool = True
    automation_failures: bool = True
    email_notifications_enabled: bool = False
    email_recipient: Optional[str] = None
    updated_at: Optional[str] = None


class NotificationPreferencesUpdate(BaseModel):
    high_priority_recs: Optional[bool] = None
    experiment_results: Optional[bool] = None
    geo_visibility_changes: Optional[bool] = None
    weekly_reports: Optional[bool] = None
    automation_failures: Optional[bool] = None
    email_notifications_enabled: Optional[bool] = None
    email_recipient: Optional[str] = None


# ── Project Health & Freshness Models ─────────────────────────────────────────

class FreshnessIndicator(BaseModel):
    last_updated: Optional[str] = None
    freshness_label: str = "Unavailable"
    is_fresh: bool = False
    details: Optional[str] = None


class ProjectHealthReport(BaseModel):
    project_id: str
    project_name: str
    seo: FreshnessIndicator
    geo: FreshnessIndicator
    gsc: FreshnessIndicator
    experiments: FreshnessIndicator
    automation: FreshnessIndicator
    summary_status: Literal["healthy", "degraded", "attention_needed"]
    active_experiments_count: int = 0
    pending_recommendations_count: int = 0
    unread_notifications_count: int = 0
