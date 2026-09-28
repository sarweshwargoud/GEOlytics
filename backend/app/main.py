"""FastAPI application entry point."""

import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.core.errors import AppError, app_error_handler, unhandled_error_handler
from app.api.routes import crawl, health, projects

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
)
logger = logging.getLogger(__name__)


def create_app() -> FastAPI:
    """Build and configure the FastAPI application."""
    settings = get_settings()

    app = FastAPI(
        title=settings.app_name,
        description="AI-powered SEO and GEO Intelligence Platform — API",
        version=settings.app_version,
        docs_url="/docs",
        redoc_url="/redoc",
    )

    # ── CORS ─────────────────────────────────────────────────
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ── Error handlers ───────────────────────────────────────
    app.add_exception_handler(AppError, app_error_handler)  # type: ignore[arg-type]
    app.add_exception_handler(Exception, unhandled_error_handler)  # type: ignore[arg-type]

    # ── Routes (versioned) ───────────────────────────────────
    app.include_router(health.router, prefix="/api/v1")
    app.include_router(projects.router, prefix="/api/v1")
    app.include_router(crawl.router, prefix="/api/v1")

    logger.info("Application started: %s v%s", settings.app_name, settings.app_version)
    return app


app = create_app()
