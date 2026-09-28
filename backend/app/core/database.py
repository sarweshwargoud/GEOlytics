"""Supabase client initialization."""

from supabase import create_client, Client
from app.core.config import get_settings

_client: Client | None = None
_admin_client: Client | None = None


def get_supabase() -> Client:
    """Return Supabase client using the anon key (respects RLS)."""
    global _client
    if _client is None:
        s = get_settings()
        _client = create_client(s.supabase_url, s.supabase_anon_key)
    return _client


def get_supabase_admin() -> Client:
    """Return Supabase client using the service-role key (bypasses RLS),
    or falls back to anon key if service role is not configured.
    """
    global _admin_client
    if _admin_client is None:
        s = get_settings()
        key = s.supabase_service_role_key or s.supabase_anon_key
        _admin_client = create_client(s.supabase_url, key)
    return _admin_client
