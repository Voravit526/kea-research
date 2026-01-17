"""
Authentication utilities for KEA admin panel and user authentication.
"""

import bcrypt
import logging
import secrets
from datetime import timedelta
from typing import Optional, Tuple

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import AdminSession, User, UserSession, get_session
from app.utils.time import utcnow

logger = logging.getLogger(__name__)

# Token expiry time (24 hours)
TOKEN_EXPIRY_HOURS = 24


def hash_password(password: str) -> str:
    """Hash a password using bcrypt with automatic salt."""
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt(rounds=12)).decode()


def verify_password(password: str, stored_hash: str) -> bool:
    """Verify a password against a stored bcrypt hash (constant-time comparison)."""
    try:
        return bcrypt.checkpw(password.encode(), stored_hash.encode())
    except (ValueError, TypeError):
        return False


def generate_token() -> str:
    """Generate a secure random token."""
    return secrets.token_hex(32)


async def create_session(session: AsyncSession) -> str:
    """Create a new admin session and return the token."""
    token = generate_token()
    expires_at = utcnow() + timedelta(hours=TOKEN_EXPIRY_HOURS)

    admin_session = AdminSession(token=token, expires_at=expires_at)
    session.add(admin_session)
    await session.commit()

    return token


async def validate_token(token: str, session: AsyncSession) -> bool:
    """Validate an admin session token."""
    stmt = select(AdminSession).where(
        AdminSession.token == token, AdminSession.expires_at > utcnow()
    )
    result = await session.execute(stmt)
    return result.scalar_one_or_none() is not None


async def invalidate_token(token: str, session: AsyncSession) -> bool:
    """Invalidate (delete) an admin session token."""
    from sqlalchemy import delete

    stmt = delete(AdminSession).where(AdminSession.token == token)
    result = await session.execute(stmt)
    await session.commit()
    return result.rowcount > 0


def get_token_from_request(request: Request) -> Optional[str]:
    """Extract the bearer token from the Authorization header."""
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        return auth_header[7:]
    return None


async def require_admin_auth(
    request: Request, session: AsyncSession = Depends(get_session)
):
    """Dependency to require admin authentication."""
    token = get_token_from_request(request)

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not await validate_token(token, session):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return token


async def _get_user_from_token(token: str, session: AsyncSession) -> Optional[User]:
    """
    Look up active user by session token.

    Returns User if token is valid and user is active, None otherwise.
    """
    # Check user session
    stmt = select(UserSession).where(
        UserSession.token == token, UserSession.expires_at > utcnow()
    )
    result = await session.execute(stmt)
    user_session = result.scalar_one_or_none()

    if not user_session:
        return None

    # Load user
    stmt = select(User).where(User.id == user_session.user_id, User.is_active == True)
    result = await session.execute(stmt)
    return result.scalar_one_or_none()


async def require_user_auth(
    request: Request, session: AsyncSession = Depends(get_session)
) -> Tuple[str, User]:
    """Dependency to require user authentication. Returns (token, user)."""
    token = get_token_from_request(request)

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = await _get_user_from_token(token, session)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return token, user


async def optional_user_auth(
    request: Request, session: AsyncSession = Depends(get_session)
) -> Optional[User]:
    """Optional user auth - returns User if authenticated, None if guest."""
    token = get_token_from_request(request)
    if not token:
        return None

    try:
        return await _get_user_from_token(token, session)
    except Exception as e:
        logger.warning(f"Error during optional user auth: {e}")
        return None
