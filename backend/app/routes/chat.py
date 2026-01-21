"""
Chat routes with 4-step KEA pipeline.

Step 1: Initial Responses - Independent answers with confidence + atomic facts
Step 2: MoA Refinement - Each provider sees all Step 1, creates improved answer
Step 3: Peer Evaluation - Ranking, fact verification, flagging
Step 4: KEA Synthesis - Final answer from best-ranked provider
"""

from typing import Optional

from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import ProviderConfig, ProviderSet, ProviderSetMember, User, get_session
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.models.request import ChatRequest
from app.providers.registry import provider_registry
from app.services.pipeline import PipelineOrchestrator
from app.utils.auth import optional_user_auth
from app.utils.db_helpers import get_bool_setting
from app.utils.exceptions import raise_bad_request, raise_unauthorized

router = APIRouter()


async def check_chat_access(
    request: Request,
    session: AsyncSession = Depends(get_session),
) -> Optional[User]:
    """Check if user has access to chat. Allows guest if enabled."""
    # Check if guest access is allowed
    allow_guest = await get_bool_setting(session, "allow_guest_access", True)

    # Try to get authenticated user
    user = await optional_user_auth(request, session)

    if user:
        return user
    elif allow_guest:
        return None  # Guest access allowed
    else:
        raise_unauthorized("Login required")


@router.post("/chat")
async def chat(
    request: ChatRequest,
    user: Optional[User] = Depends(check_chat_access),
    session: AsyncSession = Depends(get_session),
):
    """
    POST /api/chat - 4-step KEA pipeline

    Runs all providers through 4 steps:
    1. Initial Responses - Independent answers with confidence + atomic facts
    2. MoA Refinement - Each provider improves answer seeing all Step 1 responses
    3. Peer Evaluation - Providers rank and evaluate each other's Step 2 answers
    4. KEA Synthesis - Best-ranked provider creates final synthesized answer

    Requires authentication unless guest access is enabled.

    Optionally accepts provider_set_id to use only providers from that set.

    Returns SSE stream with events:
    - step_start: Beginning of a step {step, name}
    - step1_chunk/step2_chunk/step3_chunk/step4_chunk: Content chunk {provider, content}
    - step1_done/step2_done/step3_done/step4_done: Provider completed step {provider, success, ...}
    - step1_error/step2_error/step3_error/step4_error: Provider error {provider, error}
    - step_complete: Step finished {step, count}
    - step4_synthesizer: Selected synthesizer for final answer {provider, label}
    - pipeline_complete: All steps finished {step1_count, step2_count, ..., final_answer}
    """
    # Get providers - either from a specific set or all active
    if request.provider_set_id:
        providers = await get_providers_for_set(session, request.provider_set_id)
    else:
        providers = provider_registry.get_active_providers()

    if not providers:
        raise_bad_request("No AI providers configured. Check API keys.")

    if len(providers) < 2:
        raise_bad_request(
            f"Pipeline requires at least 2 providers. Currently active: {', '.join(p.name for p in providers)}"
        )

    # Extract question from last user message
    question = ""
    for msg in reversed(request.messages):
        if msg.role == "user":
            # Extract text from content (handle both string and multimodal)
            if isinstance(msg.content, str):
                question = msg.content
            elif isinstance(msg.content, list):
                # Multimodal: extract text parts
                text_parts = []
                for block in msg.content:
                    if isinstance(block, dict) and block.get("type") == "text":
                        text_parts.append(block.get("text", ""))
                question = " ".join(text_parts).strip() or "(image)"
            break

    if not question:
        raise_bad_request("No user message found")

    # Create pipeline orchestrator
    orchestrator = PipelineOrchestrator(providers=providers)

    # Convert messages to dict format (properly serialize Pydantic models)
    messages = []
    for m in request.messages:
        # If content is a list of Pydantic models, convert to dicts
        if isinstance(m.content, list):
            content = [
                item.model_dump() if hasattr(item, 'model_dump') else item
                for item in m.content
            ]
        else:
            content = m.content
        messages.append({"role": m.role, "content": content})

    return StreamingResponse(
        orchestrator.run_pipeline(messages, question),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disable nginx buffering
        },
    )


@router.get("/providers")
async def list_providers(session: AsyncSession = Depends(get_session)):
    """List available AI providers with display info for frontend"""
    providers = []
    for name in provider_registry.get_provider_names():
        # Get provider config from database for display info
        result = await session.execute(
            select(ProviderConfig).where(ProviderConfig.name == name)
        )
        config = result.scalar_one_or_none()
        providers.append({
            "name": name,
            "display_name": config.display_name if config else name,
            "icon": config.icon if config else None
        })
    return {"providers": providers}


@router.get("/auth-status")
async def get_auth_status(session: AsyncSession = Depends(get_session)):
    """Get authentication requirements and app settings (public endpoint)."""
    guest_allowed = await get_bool_setting(session, "allow_guest_access", True)
    tts_enabled = await get_bool_setting(session, "tts_enabled", True)

    return {
        "guest_access_allowed": guest_allowed,
        "login_required": not guest_allowed,
        "tts_enabled": tts_enabled,
    }


@router.get("/provider-sets")
async def list_provider_sets(session: AsyncSession = Depends(get_session)):
    """
    List active provider sets for the navbar selector.
    Returns basic info: id, name, display_name, provider_count, is_system.
    """
    stmt = (
        select(ProviderSet)
        .where(ProviderSet.is_active == True)
        .options(selectinload(ProviderSet.members))
        .order_by(ProviderSet.sort_order)
    )
    result = await session.execute(stmt)
    provider_sets = result.scalars().all()

    return {
        "provider_sets": [
            {
                "id": ps.id,
                "name": ps.name,
                "display_name": ps.display_name,
                "description": ps.description,
                "is_system": ps.is_system,
                "provider_count": len([m for m in ps.members if m.is_enabled]),
            }
            for ps in provider_sets
        ]
    }


async def get_providers_for_set(session: AsyncSession, set_id: int):
    """
    Get active providers that are enabled in the specified set.
    Returns list of BaseProvider instances from the registry.
    """
    # Get the set with its members
    stmt = (
        select(ProviderSet)
        .where(ProviderSet.id == set_id, ProviderSet.is_active == True)
        .options(selectinload(ProviderSet.members).selectinload(ProviderSetMember.provider))
    )
    result = await session.execute(stmt)
    provider_set = result.scalar_one_or_none()

    if not provider_set:
        raise_bad_request(f"Provider set {set_id} not found or inactive")

    # Get enabled provider names from the set
    enabled_provider_names = [
        m.provider.name
        for m in provider_set.members
        if m.is_enabled and m.provider.is_active
    ]

    if not enabled_provider_names:
        raise_bad_request(f"No enabled providers in set '{provider_set.display_name}'")

    # Get provider instances from registry
    providers = []
    for name in enabled_provider_names:
        provider = provider_registry.get_provider(name)
        if provider and provider.is_configured():
            providers.append(provider)

    return providers
