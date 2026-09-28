"""Centralized exception handling for the API."""

from fastapi import Request
from fastapi.responses import JSONResponse
import logging

logger = logging.getLogger(__name__)


class AppError(Exception):
    """Base application error with an HTTP status code."""

    def __init__(self, message: str, status_code: int = 500):
        self.message = message
        self.status_code = status_code
        super().__init__(message)


class NotFoundError(AppError):
    def __init__(self, resource: str = "Resource"):
        super().__init__(f"{resource} not found", 404)


class ForbiddenError(AppError):
    def __init__(self):
        super().__init__("You do not have access to this resource", 403)


class ValidationError(AppError):
    def __init__(self, message: str):
        super().__init__(message, 422)


async def app_error_handler(_request: Request, exc: AppError) -> JSONResponse:
    """Handle known application errors."""
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": exc.message},
    )


async def unhandled_error_handler(_request: Request, exc: Exception) -> JSONResponse:
    """Handle unexpected errors without leaking internals."""
    logger.exception("Unhandled error: %s", exc)
    return JSONResponse(
        status_code=500,
        content={"error": "An internal error occurred"},
    )
