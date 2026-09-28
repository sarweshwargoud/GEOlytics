"""API routes for user notifications and preferences."""

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.auth import get_current_user
from app.services.automation.models import (
    NotificationOut,
    NotificationPreferencesModel,
    NotificationPreferencesUpdate,
)
from app.services.automation.service import AutomationService

notifications_router = APIRouter(tags=["Notifications"])


@notifications_router.get("/projects/{project_id}/notifications", response_model=List[NotificationOut])
async def list_notifications(
    project_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Lists notifications for the user on this project."""
    AutomationService._verify_project_ownership(project_id, current_user["id"])
    return await AutomationService.list_notifications(
        user_id=current_user["id"],
        project_id=project_id,
    )


@notifications_router.post("/notifications/{notification_id}/read")
async def mark_notification_read(
    notification_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Marks a single notification as read."""
    await AutomationService.mark_notification_read(
        notification_id=notification_id,
        user_id=current_user["id"],
    )
    return {"status": "ok", "message": "Notification marked as read"}


@notifications_router.post("/projects/{project_id}/notifications/read-all")
async def mark_all_read(
    project_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Marks all notifications as read for this project."""
    AutomationService._verify_project_ownership(project_id, current_user["id"])
    await AutomationService.mark_all_notifications_read(
        user_id=current_user["id"],
        project_id=project_id,
    )
    return {"status": "ok", "message": "All notifications marked as read"}


@notifications_router.get("/projects/{project_id}/notifications/preferences", response_model=NotificationPreferencesModel)
async def get_notification_preferences(
    project_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Retrieves user notification preferences for this project."""
    AutomationService._verify_project_ownership(project_id, current_user["id"])
    return await AutomationService.get_notification_preferences(
        project_id=project_id,
        user_id=current_user["id"],
    )


@notifications_router.put("/projects/{project_id}/notifications/preferences", response_model=NotificationPreferencesModel)
async def update_notification_preferences(
    project_id: str,
    payload: NotificationPreferencesUpdate,
    current_user: dict = Depends(get_current_user),
):
    """Updates user notification preferences for this project."""
    AutomationService._verify_project_ownership(project_id, current_user["id"])
    return await AutomationService.update_notification_preferences(
        project_id=project_id,
        user_id=current_user["id"],
        payload=payload,
    )
