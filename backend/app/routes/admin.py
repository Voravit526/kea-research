"""
Admin API routes for managing LLM providers and models.
All routes require authentication via Bearer token.
"""

import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel, Field
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

logger = logging.getLogger(__name__)

from app.config import settings
from app.database import (
    AppSettings,
    ModelConfig,
    ProviderConfig,
    ProviderSet,
    ProviderSetMember,
    get_session,
    get_app_setting,
    set_app_setting,
)
from app.utils.seed import get_default_provider_names
from app.utils.auth import (
    create_session,
    invalidate_token,
    require_admin_auth,
    verify_password,
)
from app.utils.db_helpers import (
    bool_to_str,
    check_duplicate,
    deactivate_other_models,
    get_bool_setting,
    get_or_404,
    set_bool_setting,
    update_from_pydantic,
)
from app.utils.exceptions import (
    raise_bad_gateway,
    raise_bad_request,
    raise_conflict,
    raise_not_found,
    raise_unauthorized,
)

router = APIRouter()


# ============================================================================
# Request/Response Models
# ============================================================================


class LoginRequest(BaseModel):
    password: str


class LoginResponse(BaseModel):
    token: str
    expires_in: int = Field(description="Token expiry time in seconds")


class ProviderCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    provider_type: str = Field(
        ...,
        description="Provider type: openai, anthropic, google, mistral, xai, openai-compatible",
    )
    display_name: str = Field(..., min_length=1, max_length=100)
    api_key: Optional[str] = Field(None, description="API key (optional for local providers)")
    base_url: Optional[str] = Field(None, description="Custom base URL for OpenAI-compatible providers")
    icon: Optional[str] = Field(None, description="Bootstrap icon class (bi-nvidia) or SVG markup")
    is_active: bool = True


class ProviderUpdate(BaseModel):
    display_name: Optional[str] = None
    api_key: Optional[str] = None
    base_url: Optional[str] = None
    icon: Optional[str] = None
    is_active: Optional[bool] = None


class ProviderResponse(BaseModel):
    id: int
    name: str
    provider_type: str
    display_name: str
    has_api_key: bool
    base_url: Optional[str]
    icon: Optional[str]
    is_active: bool

    class Config:
        from_attributes = True

    @classmethod
    def from_db(cls, db_provider: "ProviderConfig") -> "ProviderResponse":
        """Create response from database model."""
        return cls(
            id=db_provider.id,
            name=db_provider.name,
            provider_type=db_provider.provider_type,
            display_name=db_provider.display_name,
            has_api_key=bool(db_provider.api_key),
            base_url=db_provider.base_url,
            icon=db_provider.icon,
            is_active=db_provider.is_active,
        )


class ModelCreate(BaseModel):
    provider_id: int
    model_id: str = Field(..., min_length=1, max_length=200)
    display_name: str = Field(..., min_length=1, max_length=200)
    is_active: bool = True
    is_default: bool = False
    parameters: Optional[str] = None


class ModelUpdate(BaseModel):
    display_name: Optional[str] = None
    is_active: Optional[bool] = None
    is_default: Optional[bool] = None
    parameters: Optional[str] = None


class ModelResponse(BaseModel):
    id: int
    provider_id: int
    model_id: str
    display_name: str
    is_active: bool
    is_default: bool
    parameters: Optional[str]

    class Config:
        from_attributes = True

    @classmethod
    def from_db(cls, db_model: "ModelConfig") -> "ModelResponse":
        """Create response from database model."""
        return cls(
            id=db_model.id,
            provider_id=db_model.provider_id,
            model_id=db_model.model_id,
            display_name=db_model.display_name,
            is_active=db_model.is_active,
            is_default=db_model.is_default,
            parameters=db_model.parameters,
        )


class ProviderWithModelsResponse(ProviderResponse):
    models: List[ModelResponse] = []

    @classmethod
    def from_db(cls, db_provider: "ProviderConfig") -> "ProviderWithModelsResponse":
        """Create response from database model with models."""
        # Reuse parent's from_db to avoid duplicating field mappings
        parent_data = ProviderResponse.from_db(db_provider).model_dump()
        return cls(
            **parent_data,
            models=[ModelResponse.from_db(m) for m in db_provider.models],
        )


class DiscoveredModel(BaseModel):
    model_id: str
    display_name: str
    description: Optional[str] = None


class AppSettingsResponse(BaseModel):
    allow_guest_access: bool = True
    tts_enabled: bool = True  # Global TTS toggle


class AppSettingsUpdate(BaseModel):
    allow_guest_access: Optional[bool] = None
    tts_enabled: Optional[bool] = None  # Global TTS toggle


# ============================================================================
# Provider Set Request/Response Models
# ============================================================================


class ProviderSetCreate(BaseModel):
    display_name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    provider_ids: List[int] = Field(default_factory=list, description="IDs of providers to include in the set")


class ProviderSetUpdate(BaseModel):
    display_name: Optional[str] = None
    description: Optional[str] = None


class ProviderSetMemberResponse(BaseModel):
    id: int
    set_id: int
    provider_id: int
    is_enabled: bool
    sort_order: int
    provider: ProviderWithModelsResponse

    class Config:
        from_attributes = True

    @classmethod
    def from_db(cls, member: "ProviderSetMember") -> "ProviderSetMemberResponse":
        """Create response from database model."""
        return cls(
            id=member.id,
            set_id=member.set_id,
            provider_id=member.provider_id,
            is_enabled=member.is_enabled,
            sort_order=member.sort_order,
            provider=ProviderWithModelsResponse.from_db(member.provider),
        )


class ProviderSetResponse(BaseModel):
    id: int
    name: str
    display_name: str
    description: Optional[str]
    is_system: bool
    is_active: bool
    sort_order: int
    members: List[ProviderSetMemberResponse] = []

    class Config:
        from_attributes = True

    @classmethod
    def from_db(cls, provider_set: "ProviderSet") -> "ProviderSetResponse":
        """Create response from database model."""
        return cls(
            id=provider_set.id,
            name=provider_set.name,
            display_name=provider_set.display_name,
            description=provider_set.description,
            is_system=provider_set.is_system,
            is_active=provider_set.is_active,
            sort_order=provider_set.sort_order,
            members=[ProviderSetMemberResponse.from_db(m) for m in provider_set.members],
        )


class ProviderSetAddMember(BaseModel):
    provider_id: int


# ============================================================================
# Authentication Endpoints
# ============================================================================


@router.post("/login", response_model=LoginResponse)
async def login(request: LoginRequest, session: AsyncSession = Depends(get_session)):
    """Authenticate with admin password and get a session token."""
    # Verify password using hash comparison (consistent with user password auth)
    if not settings.admin_password_hash or not verify_password(
        request.password, settings.admin_password_hash
    ):
        raise_unauthorized("Invalid password")

    # Create session token
    token = await create_session(session)
    expires_in = settings.admin_token_expiry_hours * 3600

    return LoginResponse(token=token, expires_in=expires_in)


@router.post("/logout")
async def logout(
    token: str = Depends(require_admin_auth),
    session: AsyncSession = Depends(get_session),
):
    """Invalidate the current session token."""
    await invalidate_token(token, session)
    return {"message": "Logged out successfully"}


@router.get("/verify")
async def verify_token(token: str = Depends(require_admin_auth)):
    """Verify that the current token is valid."""
    return {"valid": True}


# ============================================================================
# Provider CRUD Endpoints
# ============================================================================


@router.get("/providers", response_model=List[ProviderWithModelsResponse])
async def list_providers(
    _: str = Depends(require_admin_auth),
    session: AsyncSession = Depends(get_session),
):
    """List all provider configurations with their models."""
    stmt = select(ProviderConfig).options(selectinload(ProviderConfig.models))
    result = await session.execute(stmt)
    providers = result.scalars().all()

    return [ProviderWithModelsResponse.from_db(p) for p in providers]


@router.post("/providers", response_model=ProviderResponse, status_code=status.HTTP_201_CREATED)
async def create_provider(
    provider: ProviderCreate,
    _: str = Depends(require_admin_auth),
    session: AsyncSession = Depends(get_session),
):
    """Create a new provider configuration."""
    # Check for duplicate name
    await check_duplicate(
        session, ProviderConfig, ProviderConfig.name, provider.name,
        f"Provider with name '{provider.name}' already exists",
    )

    # Validate provider_type
    valid_types = ["openai", "anthropic", "google", "mistral", "xai", "openrouter", "openai-compatible"]
    if provider.provider_type not in valid_types:
        raise_bad_request(f"Invalid provider_type. Must be one of: {', '.join(valid_types)}")

    # Require base_url for openai-compatible
    if provider.provider_type == "openai-compatible" and not provider.base_url:
        raise_bad_request("base_url is required for openai-compatible providers")

    db_provider = ProviderConfig(
        name=provider.name,
        provider_type=provider.provider_type,
        display_name=provider.display_name,
        api_key=provider.api_key,
        base_url=provider.base_url,
        icon=provider.icon,
        is_active=provider.is_active,
    )
    session.add(db_provider)
    await session.commit()
    await session.refresh(db_provider)

    logger.info(f"Created provider: {db_provider.name} (type={db_provider.provider_type})")

    return ProviderResponse.from_db(db_provider)


@router.get("/providers/{provider_id}", response_model=ProviderWithModelsResponse)
async def get_provider(
    provider_id: int,
    _: str = Depends(require_admin_auth),
    session: AsyncSession = Depends(get_session),
):
    """Get a specific provider configuration with its models."""
    stmt = (
        select(ProviderConfig)
        .where(ProviderConfig.id == provider_id)
        .options(selectinload(ProviderConfig.models))
    )
    result = await session.execute(stmt)
    provider = result.scalar_one_or_none()

    if not provider:
        raise_not_found("Provider", provider_id)

    return ProviderWithModelsResponse.from_db(provider)


@router.put("/providers/{provider_id}", response_model=ProviderResponse)
async def update_provider(
    provider_id: int,
    provider_update: ProviderUpdate,
    _: str = Depends(require_admin_auth),
    session: AsyncSession = Depends(get_session),
):
    """Update a provider configuration."""
    provider = await get_or_404(session, ProviderConfig, provider_id)

    update_from_pydantic(provider, provider_update)

    await session.commit()
    await session.refresh(provider)

    logger.info(f"Updated provider: {provider.name} (id={provider_id})")

    return ProviderResponse.from_db(provider)


@router.delete("/providers/{provider_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_provider(
    provider_id: int,
    _: str = Depends(require_admin_auth),
    session: AsyncSession = Depends(get_session),
):
    """Delete a provider configuration and all its models."""
    provider = await get_or_404(session, ProviderConfig, provider_id)

    provider_name = provider.name

    # Track deletion of default providers to prevent re-seeding
    default_names = get_default_provider_names()
    if provider_name in default_names:
        deleted_defaults = await get_app_setting(session, 'deleted_defaults', [])
        if provider_name not in deleted_defaults:
            deleted_defaults.append(provider_name)
            await set_app_setting(session, 'deleted_defaults', deleted_defaults)
            logger.info(f"Added '{provider_name}' to deleted_defaults list")

    await session.delete(provider)
    await session.commit()

    logger.info(f"Deleted provider: {provider_name} (id={provider_id})")


@router.patch("/providers/{provider_id}/toggle", response_model=ProviderResponse)
async def toggle_provider(
    provider_id: int,
    _: str = Depends(require_admin_auth),
    session: AsyncSession = Depends(get_session),
):
    """Toggle provider active status."""
    provider = await get_or_404(session, ProviderConfig, provider_id)

    provider.is_active = not provider.is_active
    await session.commit()
    await session.refresh(provider)

    logger.info(
        f"Toggled provider: {provider.name} (id={provider_id}, active={provider.is_active})"
    )

    return ProviderResponse.from_db(provider)


# ============================================================================
# Model CRUD Endpoints
# ============================================================================


@router.get("/providers/{provider_id}/models", response_model=List[ModelResponse])
async def list_provider_models(
    provider_id: int,
    _: str = Depends(require_admin_auth),
    session: AsyncSession = Depends(get_session),
):
    """List all models for a specific provider."""
    # Verify provider exists
    await get_or_404(session, ProviderConfig, provider_id)

    stmt = select(ModelConfig).where(ModelConfig.provider_id == provider_id)
    result = await session.execute(stmt)
    models = result.scalars().all()

    return [ModelResponse.from_db(m) for m in models]


@router.post("/models", response_model=ModelResponse, status_code=status.HTTP_201_CREATED)
async def create_model(
    model: ModelCreate,
    _: str = Depends(require_admin_auth),
    session: AsyncSession = Depends(get_session),
):
    """Create a new model configuration."""
    # Verify provider exists
    await get_or_404(session, ProviderConfig, model.provider_id)

    # Check for duplicate model_id within provider
    stmt = select(ModelConfig).where(
        ModelConfig.provider_id == model.provider_id,
        ModelConfig.model_id == model.model_id,
    )
    result = await session.execute(stmt)
    if result.scalar_one_or_none():
        raise_conflict(f"Model '{model.model_id}' already exists for this provider")

    # Only one model can be active per provider
    # If this model is active, deactivate all other models
    if model.is_active:
        await deactivate_other_models(session, model.provider_id)
        # If active, also make it the default
        model.is_default = True

    db_model = ModelConfig(
        provider_id=model.provider_id,
        model_id=model.model_id,
        display_name=model.display_name,
        is_active=model.is_active,
        is_default=model.is_default,
        parameters=model.parameters,
    )
    session.add(db_model)
    await session.commit()
    await session.refresh(db_model)

    logger.info(
        f"Created model: {db_model.model_id} for provider_id={db_model.provider_id}"
    )

    return ModelResponse.from_db(db_model)


@router.put("/models/{model_id}", response_model=ModelResponse)
async def update_model(
    model_id: int,
    model_update: ModelUpdate,
    _: str = Depends(require_admin_auth),
    session: AsyncSession = Depends(get_session),
):
    """Update a model configuration."""
    model = await get_or_404(session, ModelConfig, model_id)

    # If setting as default, unset other defaults for this provider
    if model_update.is_default:
        stmt = (
            update(ModelConfig)
            .where(
                ModelConfig.provider_id == model.provider_id,
                ModelConfig.id != model_id,
            )
            .values(is_default=False)
        )
        await session.execute(stmt)

    update_from_pydantic(model, model_update)

    await session.commit()
    await session.refresh(model)

    logger.info(f"Updated model: {model.model_id} (id={model_id})")

    return ModelResponse.from_db(model)


@router.delete("/models/{model_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_model(
    model_id: int,
    _: str = Depends(require_admin_auth),
    session: AsyncSession = Depends(get_session),
):
    """Delete a model configuration."""
    model = await get_or_404(session, ModelConfig, model_id)

    model_model_id = model.model_id
    await session.delete(model)
    await session.commit()

    logger.info(f"Deleted model: {model_model_id} (id={model_id})")


@router.patch("/models/{model_id}/toggle", response_model=ModelResponse)
async def toggle_model(
    model_id: int,
    _: str = Depends(require_admin_auth),
    session: AsyncSession = Depends(get_session),
):
    """Toggle model active status. Only one model can be active per provider."""
    model = await get_or_404(session, ModelConfig, model_id)

    new_active_status = not model.is_active

    # If activating this model, deactivate all other models for this provider
    if new_active_status:
        await deactivate_other_models(session, model.provider_id, exclude_model_id=model_id, clear_defaults=False)
        # Also set this model as default since it's the only active one
        model.is_default = True

    model.is_active = new_active_status
    await session.commit()
    await session.refresh(model)

    logger.info(
        f"Toggled model: {model.model_id} (id={model_id}, active={model.is_active})"
    )

    return ModelResponse.from_db(model)


# ============================================================================
# Model Discovery Endpoint
# ============================================================================


@router.get("/providers/{provider_id}/discover", response_model=List[DiscoveredModel])
async def discover_models(
    provider_id: int,
    _: str = Depends(require_admin_auth),
    session: AsyncSession = Depends(get_session),
):
    """Discover available models from a provider's API."""
    from app.services.model_discovery import discover_provider_models

    provider = await get_or_404(session, ProviderConfig, provider_id)

    if not provider.api_key and provider.provider_type != "openai-compatible":
        raise_bad_request("Provider has no API key configured")

    try:
        models = await discover_provider_models(
            provider_type=provider.provider_type,
            api_key=provider.api_key,
            base_url=provider.base_url,
        )
        return models
    except Exception as e:
        raise_bad_gateway(f"Failed to discover models: {str(e)}")


# ============================================================================
# Utility Endpoints
# ============================================================================


@router.post("/reload")
async def reload_providers(
    _: str = Depends(require_admin_auth),
):
    """Reload providers from database (useful after config changes)."""
    from app.providers.registry import provider_registry

    await provider_registry.cleanup()
    await provider_registry.initialize()
    return {"message": "Providers reloaded successfully"}


# ============================================================================
# Application Settings Endpoints
# ============================================================================


@router.get("/settings", response_model=AppSettingsResponse)
async def get_app_settings(
    _: str = Depends(require_admin_auth),
    session: AsyncSession = Depends(get_session),
):
    """Get application settings."""
    return AppSettingsResponse(
        allow_guest_access=await get_bool_setting(session, "allow_guest_access", True),
        tts_enabled=await get_bool_setting(session, "tts_enabled", True),
    )


@router.put("/settings", response_model=AppSettingsResponse)
async def update_app_settings(
    settings_update: AppSettingsUpdate,
    _: str = Depends(require_admin_auth),
    session: AsyncSession = Depends(get_session),
):
    """Update application settings."""
    if settings_update.allow_guest_access is not None:
        await set_bool_setting(session, "allow_guest_access", settings_update.allow_guest_access)

    if settings_update.tts_enabled is not None:
        await set_bool_setting(session, "tts_enabled", settings_update.tts_enabled)

    await session.commit()

    # Return current settings
    return AppSettingsResponse(
        allow_guest_access=await get_bool_setting(session, "allow_guest_access", True),
        tts_enabled=await get_bool_setting(session, "tts_enabled", True),
    )


# ============================================================================
# Provider Set CRUD Endpoints
# ============================================================================


@router.get("/provider-sets", response_model=List[ProviderSetResponse])
async def list_provider_sets(
    _: str = Depends(require_admin_auth),
    session: AsyncSession = Depends(get_session),
):
    """List all provider sets with their members."""
    stmt = (
        select(ProviderSet)
        .options(
            selectinload(ProviderSet.members).selectinload(ProviderSetMember.provider).selectinload(ProviderConfig.models)
        )
        .order_by(ProviderSet.sort_order)
    )
    result = await session.execute(stmt)
    provider_sets = result.scalars().all()

    return [ProviderSetResponse.from_db(ps) for ps in provider_sets]


@router.post("/provider-sets", response_model=ProviderSetResponse, status_code=status.HTTP_201_CREATED)
async def create_provider_set(
    data: ProviderSetCreate,
    _: str = Depends(require_admin_auth),
    session: AsyncSession = Depends(get_session),
):
    """Create a new custom provider set."""
    import secrets

    # Generate unique name from display_name
    base_name = data.display_name.lower().replace(" ", "-")[:50]
    name = f"{base_name}-{secrets.token_hex(4)}"

    # Check for duplicate name (unlikely with random suffix but good practice)
    await check_duplicate(
        session, ProviderSet, ProviderSet.name, name,
        f"Provider set with name '{name}' already exists",
    )

    # Get max sort_order for positioning at the end
    result = await session.execute(select(ProviderSet.sort_order).order_by(ProviderSet.sort_order.desc()).limit(1))
    max_order = result.scalar() or 0

    # Create the provider set
    provider_set = ProviderSet(
        name=name,
        display_name=data.display_name,
        description=data.description,
        is_system=False,  # Custom sets are never system sets
        is_active=True,
        sort_order=max_order + 1,
    )
    session.add(provider_set)
    await session.flush()

    # Add providers as members
    for idx, provider_id in enumerate(data.provider_ids):
        # Verify provider exists
        provider = await session.get(ProviderConfig, provider_id)
        if provider:
            member = ProviderSetMember(
                set_id=provider_set.id,
                provider_id=provider_id,
                is_enabled=True,
                sort_order=idx,
            )
            session.add(member)

    await session.commit()

    # Reload with relationships
    stmt = (
        select(ProviderSet)
        .where(ProviderSet.id == provider_set.id)
        .options(
            selectinload(ProviderSet.members).selectinload(ProviderSetMember.provider).selectinload(ProviderConfig.models)
        )
    )
    result = await session.execute(stmt)
    provider_set = result.scalar_one()

    logger.info(f"Created provider set: {provider_set.name} with {len(data.provider_ids)} providers")

    return ProviderSetResponse.from_db(provider_set)


@router.get("/provider-sets/{set_id}", response_model=ProviderSetResponse)
async def get_provider_set(
    set_id: int,
    _: str = Depends(require_admin_auth),
    session: AsyncSession = Depends(get_session),
):
    """Get a specific provider set with its members."""
    stmt = (
        select(ProviderSet)
        .where(ProviderSet.id == set_id)
        .options(
            selectinload(ProviderSet.members).selectinload(ProviderSetMember.provider).selectinload(ProviderConfig.models)
        )
    )
    result = await session.execute(stmt)
    provider_set = result.scalar_one_or_none()

    if not provider_set:
        raise_not_found("ProviderSet", set_id)

    return ProviderSetResponse.from_db(provider_set)


@router.put("/provider-sets/{set_id}", response_model=ProviderSetResponse)
async def update_provider_set(
    set_id: int,
    data: ProviderSetUpdate,
    _: str = Depends(require_admin_auth),
    session: AsyncSession = Depends(get_session),
):
    """Update a custom provider set (not allowed for system sets)."""
    provider_set = await get_or_404(session, ProviderSet, set_id)

    if provider_set.is_system:
        raise_bad_request("Cannot modify system provider sets")

    if data.display_name is not None:
        provider_set.display_name = data.display_name
    if data.description is not None:
        provider_set.description = data.description

    await session.commit()

    # Reload with relationships
    stmt = (
        select(ProviderSet)
        .where(ProviderSet.id == set_id)
        .options(
            selectinload(ProviderSet.members).selectinload(ProviderSetMember.provider).selectinload(ProviderConfig.models)
        )
    )
    result = await session.execute(stmt)
    provider_set = result.scalar_one()

    logger.info(f"Updated provider set: {provider_set.name} (id={set_id})")

    return ProviderSetResponse.from_db(provider_set)


@router.delete("/provider-sets/{set_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_provider_set(
    set_id: int,
    _: str = Depends(require_admin_auth),
    session: AsyncSession = Depends(get_session),
):
    """Delete a custom provider set (not allowed for system sets)."""
    provider_set = await get_or_404(session, ProviderSet, set_id)

    if provider_set.is_system:
        raise_bad_request("Cannot delete system provider sets")

    set_name = provider_set.name
    await session.delete(provider_set)
    await session.commit()

    logger.info(f"Deleted provider set: {set_name} (id={set_id})")


@router.patch("/provider-sets/{set_id}/toggle", response_model=ProviderSetResponse)
async def toggle_provider_set(
    set_id: int,
    _: str = Depends(require_admin_auth),
    session: AsyncSession = Depends(get_session),
):
    """Toggle provider set active status."""
    provider_set = await get_or_404(session, ProviderSet, set_id)

    provider_set.is_active = not provider_set.is_active
    await session.commit()

    # Reload with relationships
    stmt = (
        select(ProviderSet)
        .where(ProviderSet.id == set_id)
        .options(
            selectinload(ProviderSet.members).selectinload(ProviderSetMember.provider).selectinload(ProviderConfig.models)
        )
    )
    result = await session.execute(stmt)
    provider_set = result.scalar_one()

    logger.info(f"Toggled provider set: {provider_set.name} (id={set_id}, active={provider_set.is_active})")

    return ProviderSetResponse.from_db(provider_set)


@router.patch("/provider-sets/{set_id}/members/{member_id}/toggle", response_model=ProviderSetMemberResponse)
async def toggle_provider_set_member(
    set_id: int,
    member_id: int,
    _: str = Depends(require_admin_auth),
    session: AsyncSession = Depends(get_session),
):
    """Toggle a provider's enabled status within a set."""
    # Get the member with provider relationship
    stmt = (
        select(ProviderSetMember)
        .where(ProviderSetMember.id == member_id, ProviderSetMember.set_id == set_id)
        .options(selectinload(ProviderSetMember.provider).selectinload(ProviderConfig.models))
    )
    result = await session.execute(stmt)
    member = result.scalar_one_or_none()

    if not member:
        raise_not_found("ProviderSetMember", member_id)

    member.is_enabled = not member.is_enabled
    await session.commit()
    await session.refresh(member)

    logger.info(f"Toggled provider set member: set_id={set_id}, member_id={member_id}, enabled={member.is_enabled}")

    return ProviderSetMemberResponse.from_db(member)


@router.post("/provider-sets/{set_id}/members", response_model=ProviderSetMemberResponse, status_code=status.HTTP_201_CREATED)
async def add_provider_to_set(
    set_id: int,
    data: ProviderSetAddMember,
    _: str = Depends(require_admin_auth),
    session: AsyncSession = Depends(get_session),
):
    """Add a provider to a custom set (not allowed for system sets)."""
    provider_set = await get_or_404(session, ProviderSet, set_id)

    if provider_set.is_system:
        raise_bad_request("Cannot add providers to system sets")

    # Verify provider exists
    provider = await session.get(ProviderConfig, data.provider_id)
    if not provider:
        raise_not_found("Provider", data.provider_id)

    # Check if provider is already in the set
    stmt = select(ProviderSetMember).where(
        ProviderSetMember.set_id == set_id,
        ProviderSetMember.provider_id == data.provider_id,
    )
    result = await session.execute(stmt)
    if result.scalar_one_or_none():
        raise_conflict("Provider is already in this set")

    # Get max sort_order for positioning at the end
    result = await session.execute(
        select(ProviderSetMember.sort_order)
        .where(ProviderSetMember.set_id == set_id)
        .order_by(ProviderSetMember.sort_order.desc())
        .limit(1)
    )
    max_order = result.scalar() or 0

    member = ProviderSetMember(
        set_id=set_id,
        provider_id=data.provider_id,
        is_enabled=True,
        sort_order=max_order + 1,
    )
    session.add(member)
    await session.commit()

    # Reload with provider relationship
    stmt = (
        select(ProviderSetMember)
        .where(ProviderSetMember.id == member.id)
        .options(selectinload(ProviderSetMember.provider).selectinload(ProviderConfig.models))
    )
    result = await session.execute(stmt)
    member = result.scalar_one()

    logger.info(f"Added provider {data.provider_id} to set {set_id}")

    return ProviderSetMemberResponse.from_db(member)


@router.delete("/provider-sets/{set_id}/members/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_provider_from_set(
    set_id: int,
    member_id: int,
    _: str = Depends(require_admin_auth),
    session: AsyncSession = Depends(get_session),
):
    """Remove a provider from a custom set (not allowed for system sets)."""
    provider_set = await get_or_404(session, ProviderSet, set_id)

    if provider_set.is_system:
        raise_bad_request("Cannot remove providers from system sets")

    # Get the member
    stmt = select(ProviderSetMember).where(
        ProviderSetMember.id == member_id,
        ProviderSetMember.set_id == set_id,
    )
    result = await session.execute(stmt)
    member = result.scalar_one_or_none()

    if not member:
        raise_not_found("ProviderSetMember", member_id)

    await session.delete(member)
    await session.commit()

    logger.info(f"Removed member {member_id} from set {set_id}")
