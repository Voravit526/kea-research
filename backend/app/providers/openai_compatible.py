"""
OpenAI-compatible provider for Ollama, LM Studio, vLLM, and other OpenAI-compatible APIs.
"""

import httpx
from typing import Optional

from app.providers.base import OpenAIFormatProvider


class OpenAICompatibleProvider(OpenAIFormatProvider):
    """Provider for OpenAI-compatible APIs (Ollama, LM Studio, vLLM, etc.).

    Unlike other providers, this one accepts dynamic base_url and name at runtime.
    """

    def __init__(
        self,
        api_key: Optional[str],
        model: str,
        base_url: str,
        name: str,
    ):
        """
        Initialize an OpenAI-compatible provider.

        Args:
            api_key: Optional API key (some local servers don't require auth)
            model: The model to use
            base_url: The base URL of the API (e.g., http://localhost:11434/v1)
            name: The unique name for this provider instance
        """
        # Set instance attributes directly (don't call parent __init__)
        self.api_key = api_key
        self.model = model
        self.name = name
        self.base_url = base_url.rstrip("/")

        # Build headers (Authorization is optional for local servers)
        headers = {"Content-Type": "application/json"}
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"

        self._client = httpx.AsyncClient(
            base_url=self.base_url,
            headers=headers,
            timeout=self.timeout,
        )

    def is_configured(self) -> bool:
        """Check if provider is configured (always true for compatible providers)."""
        # OpenAI-compatible providers may not require an API key
        return True
