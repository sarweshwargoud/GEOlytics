"""Health-check route with detailed subsystem configuration statuses."""

from fastapi import APIRouter
from app.core.config import get_settings
from app.core.database import get_supabase_admin
from app.schemas.projects import HealthOut
from app.services.agent.hindsight import HindsightMemoryService
from app.services.geo.analyzer import GEOVisibilityAnalyzer
from app.services.geo.tavily_provider import TavilyResearchService
from app.services.gsc.service import GoogleSearchConsoleService

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthOut, response_model_exclude_none=True)
async def health(detailed: bool = False):
    """Returns overall API health and external subsystem configuration readiness without exposing credentials."""
    s = get_settings()

    if not detailed:
        return HealthOut(
            status="healthy",
            service=s.app_name,
            version=s.app_version,
        )

    # Database check
    db_status = "healthy"
    try:
        supabase = get_supabase_admin()
        supabase.table("projects").select("id").limit(1).execute()
    except Exception:
        db_status = "unhealthy"

    # Services check
    tavily = TavilyResearchService()
    hindsight = HindsightMemoryService()
    geo_analyzer = GEOVisibilityAnalyzer()
    capabilities = {c.provider: ("configured" if c.configured else "unconfigured") for c in geo_analyzer.get_capabilities()}

    services_status = {
        "api": "healthy",
        "database": db_status,
        "gsc": "configured" if GoogleSearchConsoleService.is_configured() else "unconfigured",
        "openai": capabilities.get("openai", "unconfigured"),
        "gemini": capabilities.get("gemini", "unconfigured"),
        "grok": capabilities.get("grok", "unconfigured"),
        "claude": capabilities.get("claude", "unconfigured"),
        "tavily": "configured" if tavily.is_configured() else "unconfigured",
        "hindsight": "configured" if hindsight.is_configured() else "fallback",
    }

    overall_status = "healthy" if db_status == "healthy" else "degraded"

    return HealthOut(
        status=overall_status,
        service=s.app_name,
        version=s.app_version,
        database=db_status,
        services=services_status,
    )
