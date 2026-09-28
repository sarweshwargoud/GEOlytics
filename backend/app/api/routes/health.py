"""Health-check route."""

from fastapi import APIRouter
from app.core.config import get_settings
from app.schemas.projects import HealthOut

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthOut)
async def health():
    """Return service health status."""
    s = get_settings()
    return HealthOut(status="healthy", service=s.app_name, version=s.app_version)
