"""
HTTP Exception helpers to reduce code duplication in routes.

Usage:
    from app.utils.exceptions import raise_unauthorized, raise_bad_request

    raise_unauthorized("Invalid token")
    raise_bad_request("Missing required field")
"""

from typing import NoReturn

from fastapi import HTTPException, status


def raise_unauthorized(detail: str = "Unauthorized") -> NoReturn:
    """Raise HTTP 401 Unauthorized with WWW-Authenticate header."""
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


def raise_forbidden(detail: str = "Forbidden") -> NoReturn:
    """Raise HTTP 403 Forbidden."""
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail=detail,
    )


def raise_bad_request(detail: str) -> NoReturn:
    """Raise HTTP 400 Bad Request."""
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=detail,
    )


def raise_not_found(resource: str, id: int | str | None = None) -> NoReturn:
    """Raise HTTP 404 Not Found."""
    if id is not None:
        detail = f"{resource} with id {id} not found"
    else:
        detail = f"{resource} not found"
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=detail,
    )


def raise_conflict(detail: str) -> NoReturn:
    """Raise HTTP 409 Conflict."""
    raise HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail=detail,
    )


def raise_bad_gateway(detail: str) -> NoReturn:
    """Raise HTTP 502 Bad Gateway."""
    raise HTTPException(
        status_code=status.HTTP_502_BAD_GATEWAY,
        detail=detail,
    )


def raise_internal_error(detail: str = "Internal server error") -> NoReturn:
    """Raise HTTP 500 Internal Server Error."""
    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail=detail,
    )
