"""Configuration loaded from environment variables."""

import os
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings. All values come from env vars or .env file."""

    # ── App ────────────────────────────────────────────────────
    app_name: str = "SEO+GEO Intelligence Platform"
    app_version: str = "0.1.0"
    debug: bool = False
    cors_origins: list[str] = ["http://localhost:5173"]

    # ── Supabase ───────────────────────────────────────────────
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""  # PRIVATE — never expose

    # ── AI Search Providers (GEO) ──────────────────────────────
    openai_api_key: str = ""     # PRIVATE — Phase 3
    gemini_api_key: str = ""     # PRIVATE — Phase 3
    anthropic_api_key: str = ""  # PRIVATE — Phase 3
    xai_api_key: str = ""        # PRIVATE — Phase 3
    tavily_api_key: str = ""     # PRIVATE — Phase 3

    # ── Google Search Console ──────────────────────────────────
    gsc_client_id: str = ""      # PRIVATE — Phase 3
    gsc_client_secret: str = ""  # PRIVATE — Phase 3
    gsc_redirect_uri: str = "http://localhost:8000/api/v1/gsc/callback"

    # ── Hindsight ──────────────────────────────────────────────
    hindsight_api_key: str = ""   # PRIVATE — Phase 4
    hindsight_base_url: str = ""  # Optional custom/self-hosted Hindsight endpoint

    # ── Automation & Notifications (Phase 6) ───────────────────
    automation_secret_key: str = ""
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    notification_email_from: str = "notifications@geolytics.ai"

    model_config = {
        "env_file": [".env", "../.env"],
        "env_file_encoding": "utf-8",
        "case_sensitive": False,
        "extra": "ignore",
    }


@lru_cache
def get_settings() -> Settings:
    """Return cached Settings instance."""
    return Settings()
