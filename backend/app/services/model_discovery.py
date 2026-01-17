"""
Model discovery service for fetching available models from LLM provider APIs.
"""

import logging
from typing import Any, Dict, List, Optional

import httpx

logger = logging.getLogger(__name__)

# ============================================================================
# Helper Functions
# ============================================================================

_HTTP_TIMEOUT = 30.0


async def _fetch_json(url: str, headers: Optional[Dict[str, str]] = None) -> Dict[str, Any]:
    """Fetch JSON from API endpoint."""
    async with httpx.AsyncClient(timeout=_HTTP_TIMEOUT) as client:
        response = await client.get(url, headers=headers or {})
        response.raise_for_status()
        return response.json()


def _model_dict(
    model_id: str, display_name: str, description: Optional[str] = None
) -> Dict[str, Any]:
    """Create standardized model dictionary."""
    return {"model_id": model_id, "display_name": display_name, "description": description}


def _sort_by_id(models: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Sort models by model_id in place and return."""
    models.sort(key=lambda m: m["model_id"])
    return models


async def discover_provider_models(
    provider_type: str,
    api_key: Optional[str] = None,
    base_url: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Discover available models from a provider's API.

    Args:
        provider_type: The type of provider (openai, anthropic, google, mistral, xai, openai-compatible)
        api_key: The API key for authentication
        base_url: Custom base URL (for openai-compatible providers)

    Returns:
        List of discovered models as dicts with model_id, display_name, description
    """
    discovery_functions = {
        "openai": _discover_openai_models,
        "anthropic": _discover_anthropic_models,
        "google": _discover_google_models,
        "mistral": _discover_mistral_models,
        "xai": _discover_xai_models,
        "openrouter": _discover_openrouter_models,
        "openai-compatible": _discover_openai_compatible_models,
    }

    if provider_type not in discovery_functions:
        raise ValueError(f"Unknown provider type: {provider_type}")

    return await discovery_functions[provider_type](api_key, base_url)


async def _discover_openai_models(
    api_key: str, base_url: Optional[str] = None
) -> List[Dict[str, Any]]:
    """Discover models from OpenAI API."""
    data = await _fetch_json(
        "https://api.openai.com/v1/models",
        headers={"Authorization": f"Bearer {api_key}"},
    )

    skip_patterns = ("text-embedding", "whisper", "tts-", "dall-e", "davinci", "babbage", "moderation")
    models = []

    for model in data.get("data", []):
        model_id = model.get("id", "")
        if any(pattern in model_id.lower() for pattern in skip_patterns):
            continue
        models.append(_model_dict(model_id, _format_openai_name(model_id)))

    return _sort_by_id(models)


def _format_openai_name(model_id: str) -> str:
    """Format OpenAI model ID to display name."""
    name = model_id.upper().replace("-", " ")
    # Common transformations
    name = name.replace("GPT 4O", "GPT-4o")
    name = name.replace("GPT 4", "GPT-4")
    name = name.replace("GPT 3.5", "GPT-3.5")
    name = name.replace("O1 ", "o1-")
    name = name.replace("O3 ", "o3-")
    return name


async def _discover_anthropic_models(
    api_key: str, base_url: Optional[str] = None
) -> List[Dict[str, Any]]:
    """Discover models from Anthropic API."""
    data = await _fetch_json(
        "https://api.anthropic.com/v1/models",
        headers={"x-api-key": api_key, "anthropic-version": "2023-06-01"},
    )

    models = []
    for model in data.get("data", []):
        model_id = model.get("id", "")
        models.append(_model_dict(
            model_id, model.get("display_name", model_id), model.get("description")
        ))

    return _sort_by_id(models)


async def _discover_google_models(
    api_key: str, base_url: Optional[str] = None
) -> List[Dict[str, Any]]:
    """Discover models from Google Generative AI API."""
    data = await _fetch_json(
        f"https://generativelanguage.googleapis.com/v1/models?key={api_key}"
    )

    models = []
    for model in data.get("models", []):
        full_name = model.get("name", "")
        model_id = full_name.replace("models/", "") if full_name.startswith("models/") else full_name

        # Only include models that support generateContent
        if "generateContent" not in model.get("supportedGenerationMethods", []):
            continue
        if "embedding" in model_id.lower():
            continue

        models.append(_model_dict(
            model_id, model.get("displayName", model_id), model.get("description")
        ))

    return _sort_by_id(models)


async def _discover_mistral_models(
    api_key: str, base_url: Optional[str] = None
) -> List[Dict[str, Any]]:
    """Discover models from Mistral API."""
    data = await _fetch_json(
        "https://api.mistral.ai/v1/models",
        headers={"Authorization": f"Bearer {api_key}"},
    )

    models = []
    for model in data.get("data", []):
        model_id = model.get("id", "")
        if "embed" in model_id.lower():
            continue

        # Build description from capabilities
        caps = model.get("capabilities", {})
        cap_list = [c for c, v in [
            ("Chat", caps.get("completion_chat")),
            ("Function Calling", caps.get("function_calling")),
            ("Vision", caps.get("vision")),
        ] if v]
        description = ", ".join(cap_list) if cap_list else None

        models.append(_model_dict(model_id, _format_mistral_name(model_id), description))

    return _sort_by_id(models)


def _format_mistral_name(model_id: str) -> str:
    """Format Mistral model ID to display name."""
    # Replace common patterns
    name = model_id.replace("-", " ").title()
    name = name.replace("Mistral ", "Mistral-")
    name = name.replace("Pixtral ", "Pixtral-")
    name = name.replace("Codestral ", "Codestral-")
    return name


async def _discover_xai_models(
    api_key: str, base_url: Optional[str] = None
) -> List[Dict[str, Any]]:
    """Discover models from xAI API."""
    data = await _fetch_json(
        "https://api.x.ai/v1/models",
        headers={"Authorization": f"Bearer {api_key}"},
    )

    models = [
        _model_dict(m.get("id", ""), _format_xai_name(m.get("id", "")))
        for m in data.get("data", [])
    ]
    return _sort_by_id(models)


def _format_xai_name(model_id: str) -> str:
    """Format xAI model ID to display name."""
    name = model_id.replace("-", " ").title()
    name = name.replace("Grok ", "Grok-")
    return name


async def _discover_openrouter_models(
    api_key: str, base_url: Optional[str] = None
) -> List[Dict[str, Any]]:
    """Discover models from OpenRouter API."""
    data = await _fetch_json(
        "https://openrouter.ai/api/v1/models",
        headers={"Authorization": f"Bearer {api_key}"},
    )

    models = []
    for model in data.get("data", []):
        model_id = model.get("id", "")
        # Skip embedding models
        if "embed" in model_id.lower():
            continue

        # Use OpenRouter's name if available, otherwise format the ID
        display_name = model.get("name", _format_openrouter_name(model_id))

        # Build description from pricing and context length
        description_parts = []
        context_length = model.get("context_length")
        if context_length:
            description_parts.append(f"{context_length:,} ctx")

        pricing = model.get("pricing", {})
        prompt_price = pricing.get("prompt")
        if prompt_price and float(prompt_price) > 0:
            # Price per million tokens
            price_per_m = float(prompt_price) * 1_000_000
            description_parts.append(f"${price_per_m:.2f}/M tokens")

        description = " | ".join(description_parts) if description_parts else None

        models.append(_model_dict(model_id, display_name, description))

    return _sort_by_id(models)


def _format_openrouter_name(model_id: str) -> str:
    """Format OpenRouter model ID to display name."""
    # OpenRouter IDs are like "openai/gpt-4o" or "anthropic/claude-3.5-sonnet"
    if "/" in model_id:
        provider, model = model_id.split("/", 1)
        # Capitalize provider and format model name
        provider = provider.title()
        model = model.replace("-", " ").title()
        return f"{provider} {model}"
    return model_id.replace("-", " ").title()


async def _discover_openai_compatible_models(
    api_key: Optional[str] = None, base_url: Optional[str] = None
) -> List[Dict[str, Any]]:
    """Discover models from OpenAI-compatible API (Ollama, LM Studio, vLLM, etc.)."""
    if not base_url:
        raise ValueError("base_url is required for OpenAI-compatible providers")

    base_url = base_url.rstrip("/")
    models_url = f"{base_url}/models" if base_url.endswith("/v1") else f"{base_url}/v1/models"
    headers = {"Authorization": f"Bearer {api_key}"} if api_key else {}

    async with httpx.AsyncClient(timeout=_HTTP_TIMEOUT) as client:
        try:
            response = await client.get(models_url, headers=headers)
            response.raise_for_status()
            data = response.json()
        except httpx.HTTPStatusError as e:
            # Fallback to Ollama native API
            if "/v1" in models_url:
                alt_url = base_url.replace("/v1", "") + "/api/tags"
                try:
                    response = await client.get(alt_url, headers=headers)
                    response.raise_for_status()
                    data = response.json()
                    if "models" in data:
                        return [_model_dict(m.get("name", ""), m.get("name", ""))
                                for m in data["models"]]
                except Exception as alt_e:
                    logger.debug(f"Fallback to Ollama native API also failed: {alt_e}")
            raise e

    models = [_model_dict(m.get("id", ""), m.get("id", "")) for m in data.get("data", [])]
    return _sort_by_id(models)
