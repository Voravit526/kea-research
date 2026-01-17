import os
from typing import AsyncGenerator

from app.utils.time import utcnow

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    delete,
)
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase, relationship

# Database path - use data directory for persistence
DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")
os.makedirs(DATA_DIR, exist_ok=True)
DATABASE_PATH = os.path.join(DATA_DIR, "kea.db")
DATABASE_URL = f"sqlite+aiosqlite:///{DATABASE_PATH}"

# Create async engine
engine = create_async_engine(DATABASE_URL, echo=False)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    """Base class for all database models."""

    pass


class ProviderConfig(Base):
    """Configuration for an AI provider instance."""

    __tablename__ = "provider_configs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), unique=True, nullable=False)  # e.g., "openai-gpt4o"
    provider_type = Column(
        String(50), nullable=False
    )  # "openai", "anthropic", "google", "mistral", "xai", "openai-compatible"
    display_name = Column(String(100), nullable=False)  # Human-readable name
    api_key = Column(Text, nullable=True)  # Encrypted API key (nullable for local)
    base_url = Column(String(500), nullable=True)  # Custom URL for local models
    icon = Column(Text, nullable=True)  # Bootstrap icon class (bi-nvidia) or SVG markup
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=utcnow, nullable=False)
    updated_at = Column(
        DateTime, default=utcnow, onupdate=utcnow, nullable=False
    )

    # Relationship to models
    models = relationship(
        "ModelConfig", back_populates="provider", cascade="all, delete-orphan"
    )

    def __repr__(self):
        return f"<ProviderConfig(name='{self.name}', type='{self.provider_type}', active={self.is_active})>"


class ModelConfig(Base):
    """Configuration for a specific model within a provider."""

    __tablename__ = "model_configs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    provider_id = Column(
        Integer, ForeignKey("provider_configs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    model_id = Column(
        String(200), nullable=False
    )  # e.g., "gpt-4o", "claude-sonnet-4-20250514"
    display_name = Column(String(200), nullable=False)  # Human-readable name
    is_active = Column(Boolean, default=True, nullable=False)
    is_default = Column(
        Boolean, default=False, nullable=False
    )  # Default model for provider
    parameters = Column(Text, nullable=True)  # JSON string for optional params
    created_at = Column(DateTime, default=utcnow, nullable=False)

    # Relationship to provider
    provider = relationship("ProviderConfig", back_populates="models")

    def __repr__(self):
        return f"<ModelConfig(model_id='{self.model_id}', active={self.is_active}, default={self.is_default})>"


class ProviderSet(Base):
    """A collection of providers that can be used together."""

    __tablename__ = "provider_sets"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), unique=True, nullable=False)  # e.g., "coding-experts"
    display_name = Column(String(100), nullable=False)  # e.g., "Coding Experts"
    description = Column(Text, nullable=True)  # Optional description
    is_system = Column(Boolean, default=False, nullable=False)  # True for predefined sets
    is_active = Column(Boolean, default=True, nullable=False)  # Can disable entire set
    sort_order = Column(Integer, default=0, nullable=False)  # For UI ordering
    created_at = Column(DateTime, default=utcnow, nullable=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)

    # Relationship to set members
    members = relationship(
        "ProviderSetMember", back_populates="provider_set", cascade="all, delete-orphan"
    )

    def __repr__(self):
        return f"<ProviderSet(name='{self.name}', system={self.is_system}, active={self.is_active})>"


class ProviderSetMember(Base):
    """Association between ProviderSet and ProviderConfig with per-set settings."""

    __tablename__ = "provider_set_members"

    id = Column(Integer, primary_key=True, autoincrement=True)
    set_id = Column(
        Integer, ForeignKey("provider_sets.id", ondelete="CASCADE"),
        nullable=False, index=True
    )
    provider_id = Column(
        Integer, ForeignKey("provider_configs.id", ondelete="CASCADE"),
        nullable=False, index=True
    )
    is_enabled = Column(Boolean, default=True, nullable=False)  # Per-set enable/disable
    sort_order = Column(Integer, default=0, nullable=False)  # Order within set

    # Unique constraint: provider can only be in a set once
    __table_args__ = (
        Index('ix_provider_set_members_set_provider', 'set_id', 'provider_id', unique=True),
    )

    # Relationships
    provider_set = relationship("ProviderSet", back_populates="members")
    provider = relationship("ProviderConfig")

    def __repr__(self):
        return f"<ProviderSetMember(set_id={self.set_id}, provider_id={self.provider_id}, enabled={self.is_enabled})>"


class AdminSession(Base):
    """Admin session tokens for authentication."""

    __tablename__ = "admin_sessions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    token = Column(String(64), unique=True, nullable=False, index=True)
    created_at = Column(DateTime, default=utcnow, nullable=False)
    expires_at = Column(DateTime, nullable=False)

    def __repr__(self):
        return f"<AdminSession(token='{self.token[:8]}...', expires={self.expires_at})>"


class User(Base):
    """Regular user accounts (created by admin)."""

    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    password_hash = Column(String(100), nullable=False)  # bcrypt hash
    display_name = Column(String(100), nullable=True)  # Optional display name
    is_active = Column(Boolean, default=True, nullable=False)
    tts_enabled = Column(Boolean, default=True, nullable=False)  # User TTS preference
    created_at = Column(DateTime, default=utcnow, nullable=False)
    updated_at = Column(
        DateTime, default=utcnow, onupdate=utcnow, nullable=False
    )

    # Relationship to sessions
    sessions = relationship(
        "UserSession", back_populates="user", cascade="all, delete-orphan"
    )

    def __repr__(self):
        return f"<User(username='{self.username}', active={self.is_active})>"


class UserSession(Base):
    """User session tokens for regular user authentication."""

    __tablename__ = "user_sessions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    token = Column(String(64), unique=True, nullable=False, index=True)
    created_at = Column(DateTime, default=utcnow, nullable=False)
    expires_at = Column(DateTime, nullable=False)

    # Relationship to user
    user = relationship("User", back_populates="sessions")

    def __repr__(self):
        return f"<UserSession(user_id={self.user_id}, expires={self.expires_at})>"


class AppSettings(Base):
    """Application-wide settings configured by admin."""

    __tablename__ = "app_settings"

    key = Column(String(50), primary_key=True)
    value = Column(Text, nullable=False)  # JSON string for complex values
    updated_at = Column(
        DateTime, default=utcnow, onupdate=utcnow, nullable=False
    )

    def __repr__(self):
        return f"<AppSettings(key='{self.key}')>"


async def init_db():
    """Initialize the database, creating all tables if they don't exist."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """Get an async database session."""
    async with async_session() as session:
        try:
            yield session
        finally:
            await session.close()


async def cleanup_expired_sessions():
    """Remove expired admin and user sessions."""
    async with async_session() as session:
        # Clean expired admin sessions
        stmt = delete(AdminSession).where(AdminSession.expires_at < utcnow())
        await session.execute(stmt)

        # Clean expired user sessions
        stmt = delete(UserSession).where(UserSession.expires_at < utcnow())
        await session.execute(stmt)

        await session.commit()


# ============================================================================
# AppSettings Helpers
# ============================================================================

import json
from sqlalchemy.dialects.sqlite import insert as sqlite_insert


async def get_app_setting(session: AsyncSession, key: str, default=None):
    """Get a setting value from AppSettings.

    Args:
        session: Database session
        key: Setting key to retrieve
        default: Default value if key doesn't exist

    Returns:
        Parsed JSON value or default
    """
    from sqlalchemy import select

    result = await session.execute(
        select(AppSettings).where(AppSettings.key == key)
    )
    setting = result.scalar_one_or_none()
    if setting is None:
        return default
    try:
        return json.loads(setting.value)
    except json.JSONDecodeError:
        return setting.value


async def set_app_setting(session: AsyncSession, key: str, value) -> None:
    """Set a setting value in AppSettings (upsert).

    Args:
        session: Database session
        key: Setting key
        value: Value to store (will be JSON-encoded)
    """
    json_value = json.dumps(value)

    stmt = sqlite_insert(AppSettings).values(
        key=key,
        value=json_value
    ).on_conflict_do_update(
        index_elements=['key'],
        set_={'value': json_value}
    )
    await session.execute(stmt)
