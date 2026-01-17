"""
User management API routes.
- Admin endpoints for CRUD on users (require admin auth)
- User login/logout endpoints (public)
"""

import logging
from datetime import timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import User, UserSession, get_session
from app.utils.auth import (
    _get_user_from_token,
    generate_token,
    get_token_from_request,
    hash_password,
    require_admin_auth,
    require_user_auth,
    verify_password,
)
from app.utils.db_helpers import check_duplicate, get_or_404
from app.utils.exceptions import raise_forbidden, raise_unauthorized
from app.utils.time import utcnow

logger = logging.getLogger(__name__)

router = APIRouter()

# Token expiry for regular users (same as admin: 24 hours)
USER_TOKEN_EXPIRY_HOURS = 24


# ============================================================================
# Request/Response Models
# ============================================================================


class UserCreate(BaseModel):
    username: str = Field(
        ..., min_length=3, max_length=50, pattern=r"^[a-zA-Z0-9_-]+$"
    )
    password: str = Field(..., min_length=8, description="Minimum 8 characters")
    display_name: str = Field(..., min_length=1, max_length=100)


class UserUpdate(BaseModel):
    display_name: Optional[str] = None
    password: Optional[str] = None  # Only set if changing password
    is_active: Optional[bool] = None


class UserResponse(BaseModel):
    id: int
    username: str
    display_name: Optional[str]
    is_active: bool
    tts_enabled: bool
    created_at: str

    class Config:
        from_attributes = True

    @classmethod
    def from_db(cls, db_user: "User") -> "UserResponse":
        """Create response from database model."""
        return cls(
            id=db_user.id,
            username=db_user.username,
            display_name=db_user.display_name,
            is_active=db_user.is_active,
            tts_enabled=db_user.tts_enabled,
            created_at=db_user.created_at.isoformat(),
        )


class UserPreferencesUpdate(BaseModel):
    tts_enabled: Optional[bool] = None


class UserLoginRequest(BaseModel):
    username: str
    password: str


class UserLoginResponse(BaseModel):
    token: str
    expires_in: int
    user: UserResponse


# ============================================================================
# Admin Endpoints for User Management
# ============================================================================


@router.get("/admin/users", response_model=List[UserResponse])
async def list_users(
    _: str = Depends(require_admin_auth),
    session: AsyncSession = Depends(get_session),
):
    """List all users (admin only)."""
    stmt = select(User).order_by(User.username)
    result = await session.execute(stmt)
    users = result.scalars().all()
    return [UserResponse.from_db(u) for u in users]


@router.post(
    "/admin/users", response_model=UserResponse, status_code=status.HTTP_201_CREATED
)
async def create_user(
    user_data: UserCreate,
    _: str = Depends(require_admin_auth),
    session: AsyncSession = Depends(get_session),
):
    """Create a new user (admin only)."""
    # Check for duplicate username
    await check_duplicate(
        session, User, User.username, user_data.username,
        f"Username '{user_data.username}' already exists",
    )

    user = User(
        username=user_data.username,
        password_hash=hash_password(user_data.password),
        display_name=user_data.display_name,
    )
    session.add(user)
    await session.commit()
    await session.refresh(user)

    logger.info(f"Created user: {user.username}")

    return UserResponse.from_db(user)


@router.put("/admin/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    user_data: UserUpdate,
    _: str = Depends(require_admin_auth),
    session: AsyncSession = Depends(get_session),
):
    """Update a user (admin only)."""
    user = await get_or_404(session, User, user_id)

    if user_data.display_name is not None:
        user.display_name = user_data.display_name
    if user_data.password is not None:
        user.password_hash = hash_password(user_data.password)
    if user_data.is_active is not None:
        user.is_active = user_data.is_active
        # If deactivating user, also invalidate all their sessions
        if not user_data.is_active:
            stmt = delete(UserSession).where(UserSession.user_id == user_id)
            await session.execute(stmt)

    await session.commit()
    await session.refresh(user)

    logger.info(f"Updated user: {user.username} (id={user_id})")

    return UserResponse.from_db(user)


@router.delete("/admin/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: int,
    _: str = Depends(require_admin_auth),
    session: AsyncSession = Depends(get_session),
):
    """Delete a user (admin only)."""
    user = await get_or_404(session, User, user_id)

    username = user.username
    await session.delete(user)
    await session.commit()

    logger.info(f"Deleted user: {username} (id={user_id})")


# ============================================================================
# User Login/Logout Endpoints (Public)
# ============================================================================


@router.post("/users/login", response_model=UserLoginResponse)
async def user_login(
    request: UserLoginRequest,
    session: AsyncSession = Depends(get_session),
):
    """Authenticate a user and return a session token."""
    stmt = select(User).where(User.username == request.username)
    result = await session.execute(stmt)
    user = result.scalar_one_or_none()

    if not user or not verify_password(request.password, user.password_hash):
        raise_unauthorized("Invalid username or password")

    if not user.is_active:
        raise_forbidden("Account is disabled")

    # Create session token
    token = generate_token()
    expires_at = utcnow() + timedelta(hours=USER_TOKEN_EXPIRY_HOURS)

    user_session = UserSession(
        user_id=user.id,
        token=token,
        expires_at=expires_at,
    )
    session.add(user_session)
    await session.commit()

    return UserLoginResponse(
        token=token,
        expires_in=USER_TOKEN_EXPIRY_HOURS * 3600,
        user=UserResponse.from_db(user),
    )


@router.post("/users/logout")
async def user_logout(
    request: Request,
    session: AsyncSession = Depends(get_session),
):
    """Logout current user session."""
    token = get_token_from_request(request)
    if token:
        stmt = delete(UserSession).where(UserSession.token == token)
        await session.execute(stmt)
        await session.commit()

    return {"message": "Logged out successfully"}


@router.get("/users/verify")
async def verify_user_token(
    request: Request,
    session: AsyncSession = Depends(get_session),
):
    """Verify current user token and return user info."""
    token = get_token_from_request(request)
    if not token:
        raise_unauthorized("Missing token")

    user = await _get_user_from_token(token, session)
    if not user:
        raise_unauthorized("Invalid or expired token")

    return {
        "valid": True,
        "user": UserResponse.from_db(user),
    }


# ============================================================================
# User Preferences Endpoints
# ============================================================================


@router.patch("/users/preferences")
async def update_user_preferences(
    prefs: UserPreferencesUpdate,
    request: Request,
    session: AsyncSession = Depends(get_session),
):
    """Update current user's preferences (requires authentication)."""
    token, user = await require_user_auth(request, session)

    if prefs.tts_enabled is not None:
        user.tts_enabled = prefs.tts_enabled

    await session.commit()
    await session.refresh(user)

    return {
        "message": "Preferences updated",
        "user": UserResponse.from_db(user),
    }
