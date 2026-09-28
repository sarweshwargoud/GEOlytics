"""Authentication dependency for FastAPI routes."""

from fastapi import Request, HTTPException
from app.core.database import get_supabase


async def get_current_user(request: Request) -> dict:
    """Validate the Supabase JWT and return the authenticated user.

    Returns ``{"id": "<uuid>", "email": "<email>"}``.
    Raises 401 if the token is missing, expired, or invalid.
    """
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")

    token = auth_header.split(" ", 1)[1]

    try:
        sb = get_supabase()
        # Supabase SDK validates the JWT internally
        user_response = sb.auth.get_user(token)
        user = user_response.user

        if user is None:
            raise HTTPException(status_code=401, detail="Invalid token")

        return {"id": str(user.id), "email": user.email or ""}

    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=401, detail="Authentication failed")
