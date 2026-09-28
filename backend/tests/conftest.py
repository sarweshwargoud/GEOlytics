"""Test configuration — set environment variables before app imports."""

import os

# Set test environment variables so Settings doesn't crash on missing required fields
DUMMY_JWT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IlRlc3QiLCJpYXQiOjE1MTYyMzkwMjJ9.dummy_signature"

os.environ.setdefault("SUPABASE_URL", "https://test.supabase.co")
os.environ.setdefault("SUPABASE_ANON_KEY", DUMMY_JWT)
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", DUMMY_JWT)
