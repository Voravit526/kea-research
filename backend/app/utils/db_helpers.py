"""
Database helper functions to reduce code duplication in routes.
"""

import logging
from typing import Any, Optional, Type, TypeVar

from fastapi import HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import DeclarativeBase

logger = logging.getLogger(__name__)

T = TypeVar("T", bound=DeclarativeBase)


# ============================================================================
# Boolean String Conversion Utilities
# ============================================================================


def str_to_bool(value: Optional[str], default: bool = True) -> bool:
    """Convert string 'true'/'false' to boolean."""
    if value is None:
        return default
    return value.lower() == "true"


def bool_to_str(value: bool) -> str:
    """Convert boolean to 'true'/'false' string."""
    return "true" if value else "false"


# ============================================================================
# Settings Helpers
# ============================================================================


async def get_setting(
    session: AsyncSession,
    key: str,
    default: str = "true",
) -> str:
    """
    Get an application setting value from AppSettings table.

    Args:
        session: Database session
        key: Setting key to look up
        default: Default value if setting doesn't exist

    Returns:
        The setting value as string
    """
    from app.database import AppSettings

    stmt = select(AppSettings).where(AppSettings.key == key)
    result = await session.execute(stmt)
    setting = result.scalar_one_or_none()
    return setting.value if setting else default


async def set_setting(
    session: AsyncSession,
    key: str,
    value: str,
) -> None:
    """
    Set an application setting value in AppSettings table.

    Args:
        session: Database session
        key: Setting key to set
        value: Value to store
    """
    from app.database import AppSettings

    stmt = select(AppSettings).where(AppSettings.key == key)
    result = await session.execute(stmt)
    existing = result.scalar_one_or_none()

    if existing:
        existing.value = value
    else:
        session.add(AppSettings(key=key, value=value))


# ============================================================================
# ORM Update Helper
# ============================================================================


def update_from_pydantic(db_obj: T, pydantic_model: BaseModel) -> None:
    """
    Update SQLAlchemy model from Pydantic model (exclude_unset fields).

    Args:
        db_obj: SQLAlchemy model instance to update
        pydantic_model: Pydantic model with new values
    """
    update_data = pydantic_model.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_obj, key, value)


async def get_or_404(
    session: AsyncSession,
    model: Type[T],
    id: int,
    detail: Optional[str] = None,
) -> T:
    """
    Fetch a record by ID or raise 404.

    Args:
        session: Database session
        model: SQLAlchemy model class
        id: Primary key ID to fetch
        detail: Custom error message (default: "{Model} not found")

    Returns:
        The fetched record

    Raises:
        HTTPException: 404 if record not found
    """
    stmt = select(model).where(model.id == id)
    result = await session.execute(stmt)
    obj = result.scalar_one_or_none()

    if not obj:
        model_name = model.__name__.replace("Config", "").replace("Session", "")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=detail or f"{model_name} not found",
        )

    return obj


async def _get_by_field(
    session: AsyncSession,
    model: Type[T],
    field: Any,
    value: Any,
) -> Optional[T]:
    """Fetch a record by a specific field value (internal use)."""
    stmt = select(model).where(field == value)
    result = await session.execute(stmt)
    return result.scalar_one_or_none()


async def _exists_by_field(
    session: AsyncSession,
    model: Type[T],
    field: Any,
    value: Any,
) -> bool:
    """Check if a record exists with the given field value (internal use)."""
    return await _get_by_field(session, model, field, value) is not None


async def check_duplicate(
    session: AsyncSession,
    model: Type[T],
    field: Any,
    value: Any,
    detail: Optional[str] = None,
) -> None:
    """
    Raise 409 Conflict if a record with the given field value already exists.

    Args:
        session: Database session
        model: SQLAlchemy model class
        field: Column to check for duplicates
        value: Value that should be unique
        detail: Custom error message

    Raises:
        HTTPException: 409 if duplicate found
    """
    if await _exists_by_field(session, model, field, value):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=detail or f"{model.__name__} already exists",
        )


# ============================================================================
# Boolean Settings Helpers
# ============================================================================


async def get_bool_setting(
    session: AsyncSession,
    key: str,
    default: bool = True,
) -> bool:
    """
    Get a boolean application setting.

    Convenience wrapper combining get_setting() and str_to_bool().

    Args:
        session: Database session
        key: Setting key to look up
        default: Default boolean value if setting doesn't exist

    Returns:
        The setting value as boolean
    """
    value = await get_setting(session, key, bool_to_str(default))
    return str_to_bool(value)


async def set_bool_setting(
    session: AsyncSession,
    key: str,
    value: bool,
) -> None:
    """
    Set a boolean application setting.

    Convenience wrapper combining set_setting() and bool_to_str().

    Args:
        session: Database session
        key: Setting key to set
        value: Boolean value to store
    """
    await set_setting(session, key, bool_to_str(value))


# ============================================================================
# Model Deactivation Helper
# ============================================================================


async def deactivate_other_models(
    session: AsyncSession,
    provider_id: int,
    exclude_model_id: Optional[int] = None,
    clear_defaults: bool = True,
) -> None:
    """
    Deactivate all models for a provider, optionally excluding one.

    Used when activating a model to ensure only one model is active per provider.

    Args:
        session: Database session
        provider_id: Provider ID to deactivate models for
        exclude_model_id: Model ID to exclude from deactivation (the one being activated)
        clear_defaults: Also clear is_default flag (default True)
    """
    from app.database import ModelConfig

    values = {"is_active": False}
    if clear_defaults:
        values["is_default"] = False

    if exclude_model_id is not None:
        stmt = (
            update(ModelConfig)
            .where(
                ModelConfig.provider_id == provider_id,
                ModelConfig.id != exclude_model_id,
            )
            .values(**values)
        )
    else:
        stmt = (
            update(ModelConfig)
            .where(ModelConfig.provider_id == provider_id)
            .values(**values)
        )

    await session.execute(stmt)
