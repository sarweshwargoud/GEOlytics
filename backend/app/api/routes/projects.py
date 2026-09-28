"""Project CRUD routes."""

from fastapi import APIRouter, Depends, HTTPException
from urllib.parse import urlparse

from app.core.auth import get_current_user
from app.core.database import get_supabase_admin
from app.core.errors import NotFoundError
from app.schemas.projects import (
    ProjectCreate,
    ProjectUpdate,
    ProjectOut,
    ProjectListOut,
)

router = APIRouter(prefix="/projects", tags=["projects"])


def _normalize_url(url: str) -> str:
    """Ensure the URL has a scheme."""
    url = url.strip()
    if not url.startswith(("http://", "https://")):
        url = f"https://{url}"
    return url


@router.get("", response_model=ProjectListOut)
async def list_projects(user: dict = Depends(get_current_user)):
    """List all projects belonging to the authenticated user."""
    db = get_supabase_admin()
    result = (
        db.table("projects")
        .select("*")
        .eq("user_id", user["id"])
        .order("created_at", desc=True)
        .execute()
    )
    return ProjectListOut(projects=result.data, count=len(result.data))


@router.post("", response_model=ProjectOut, status_code=201)
async def create_project(body: ProjectCreate, user: dict = Depends(get_current_user)):
    """Create a new project."""
    db = get_supabase_admin()
    data = {
        "user_id": user["id"],
        "name": body.name.strip(),
        "website_url": _normalize_url(body.website_url),
        "industry": body.industry,
        "target_location": body.target_location,
        "language": body.language,
    }
    result = db.table("projects").insert(data).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create project")
    return result.data[0]


@router.get("/{project_id}", response_model=ProjectOut)
async def get_project(project_id: str, user: dict = Depends(get_current_user)):
    """Get a single project by ID (must belong to the user)."""
    db = get_supabase_admin()
    result = (
        db.table("projects")
        .select("*")
        .eq("id", project_id)
        .eq("user_id", user["id"])
        .execute()
    )
    if not result.data:
        raise NotFoundError("Project")
    return result.data[0]


@router.patch("/{project_id}", response_model=ProjectOut)
async def update_project(
    project_id: str,
    body: ProjectUpdate,
    user: dict = Depends(get_current_user),
):
    """Update an existing project."""
    db = get_supabase_admin()

    # Only include non-None fields
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if "website_url" in updates:
        updates["website_url"] = _normalize_url(updates["website_url"])
    if "name" in updates:
        updates["name"] = updates["name"].strip()

    if not updates:
        raise HTTPException(status_code=422, detail="No fields to update")

    result = (
        db.table("projects")
        .update(updates)
        .eq("id", project_id)
        .eq("user_id", user["id"])
        .execute()
    )
    if not result.data:
        raise NotFoundError("Project")
    return result.data[0]


@router.delete("/{project_id}", status_code=204)
async def delete_project(project_id: str, user: dict = Depends(get_current_user)):
    """Delete a project."""
    db = get_supabase_admin()
    result = (
        db.table("projects")
        .delete()
        .eq("id", project_id)
        .eq("user_id", user["id"])
        .execute()
    )
    if not result.data:
        raise NotFoundError("Project")
