"""Data models for Google Search Console (GSC) integration and search analytics."""

from datetime import date, datetime
from typing import List, Optional
from pydantic import BaseModel, Field


class GSCConnectionOut(BaseModel):
    id: str
    project_id: str
    site_url: str
    connected_at: str
    updated_at: str


class GSCSyncOut(BaseModel):
    id: str
    project_id: str
    status: str  # "pending", "syncing", "completed", "failed"
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    rows_synced: int = 0
    error: Optional[str] = None
    created_at: str


class PerformanceSummary(BaseModel):
    total_clicks: int = 0
    total_impressions: int = 0
    average_ctr: float = 0.0
    average_position: float = 0.0
    start_date: Optional[str] = None
    end_date: Optional[str] = None


class TimeseriesPoint(BaseModel):
    date: str
    clicks: int
    impressions: int
    ctr: float
    position: float


class QueryPerformanceRow(BaseModel):
    query: str
    clicks: int
    impressions: int
    ctr: float
    position: float


class PagePerformanceRow(BaseModel):
    page: str
    clicks: int
    impressions: int
    ctr: float
    position: float


class SearchPerformanceReport(BaseModel):
    is_connected: bool = False
    site_url: Optional[str] = None
    latest_sync: Optional[GSCSyncOut] = None
    summary: PerformanceSummary
    timeseries: List[TimeseriesPoint] = Field(default_factory=list)
    top_queries: List[QueryPerformanceRow] = Field(default_factory=list)
    top_pages: List[PagePerformanceRow] = Field(default_factory=list)
