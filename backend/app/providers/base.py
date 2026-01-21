import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import AsyncIterator, Callable, Optional

import httpx
import orjson

from app.config import settings

logger = logging.getLogger(__name__)

# Constants
SSE_DATA_PREFIX = "data: "
SSE_DONE_SIGNAL = "data: [DONE]"


@dataclass
class StreamChunk:
    """Represents a single streaming chunk from a provider"""

    provider: str
    content: str
    is_done: bool = False
    error: Optional[str] = None


class BaseProvider(ABC):
    """Abstract base class for AI providers"""

    name: str  # Provider identifier: "claude", "openai", "gemini", "mistral"

    def __init__(self, api_key: str, model: str):
        self.api_key = api_key
        self.model = model
        self._client = None

    @property
    def timeout(self) -> float:
        """Get the configured provider timeout in seconds."""
        return float(settings.provider_timeout)

    @property
    def is_free_tier(self) -> bool:
        """Whether this provider uses free-tier models (slower, rate-limited).

        Override in subclasses for providers known to be slower/free.
        Used by pipeline to apply longer timeouts and retry logic.
        """
        return False

    @property
    def timeout_multiplier(self) -> float:
        """Timeout multiplier for this provider.

        Free tier providers get 3x timeout to account for slower responses.
        """
        return 3.0 if self.is_free_tier else 1.0

    @property
    def supports_vision(self) -> bool:
        """Whether this provider supports image inputs (vision capabilities)."""
        # Override in providers that don't support vision
        return True

    def _prepare_message_content(self, message: dict) -> dict:
        """
        Prepare message content for this provider.
        Override in subclasses for provider-specific formatting.

        Default: pass through as-is (works for Claude format)
        """
        return message

    @abstractmethod
    async def stream_chat(
        self, messages: list[dict], system_prompt: Optional[str] = None
    ) -> AsyncIterator[StreamChunk]:
        """Stream chat completion responses"""
        pass

    async def cleanup(self):
        """Cleanup HTTP client resources."""
        if self._client:
            await self._client.aclose()
            self._client = None

    def is_configured(self) -> bool:
        """Check if provider has valid API key"""
        return bool(self.api_key)

    def _error_chunk(self, error: Exception) -> StreamChunk:
        """Create an error StreamChunk."""
        return StreamChunk(provider=self.name, content="", is_done=True, error=str(error))

    def _log_json_error(self, error: Exception) -> None:
        """Log JSON parse error at debug level."""
        logger.debug(f"JSON parse error in {self.name}: {error}")

    async def _stream_sse_lines(
        self,
        response: httpx.Response,
        extract_content: Callable[[dict], str | None],
        done_check: Callable[[dict], bool] | None = None,
    ) -> AsyncIterator[StreamChunk]:
        """
        Process SSE lines from a streaming response.

        Args:
            response: The httpx streaming response
            extract_content: Function to extract text content from parsed JSON data
            done_check: Optional function to check if stream is done from data

        Yields:
            StreamChunk objects with content or completion status
        """
        async for line in response.aiter_lines():
            if not line.startswith(SSE_DATA_PREFIX):
                continue
            if line == SSE_DONE_SIGNAL:
                yield StreamChunk(provider=self.name, content="", is_done=True)
                return

            try:
                data = orjson.loads(line[6:])

                # Check if done via data content
                if done_check and done_check(data):
                    yield StreamChunk(provider=self.name, content="", is_done=True)
                    return

                # Extract content
                content = extract_content(data)
                if content:
                    yield StreamChunk(provider=self.name, content=content)

            except orjson.JSONDecodeError as e:
                self._log_json_error(e)
                continue


class OpenAIFormatProvider(BaseProvider):
    """Base class for providers using OpenAI-compatible API format.

    Subclasses only need to set `name` and `base_url` class attributes.
    """

    name: str = ""  # Override in subclass
    base_url: str = ""  # Override in subclass

    def __init__(self, api_key: str, model: str):
        super().__init__(api_key, model)
        self._client = httpx.AsyncClient(
            base_url=self.base_url,
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            },
            timeout=self.timeout,
        )

    async def stream_chat(
        self, messages: list[dict], system_prompt: Optional[str] = None
    ) -> AsyncIterator[StreamChunk]:
        """Stream chat completion using OpenAI API format with vision support."""
        try:
            # Import here to avoid circular dependency
            from app.utils.message_helpers import format_for_openai

            formatted_messages = []
            if system_prompt:
                formatted_messages.append({"role": "system", "content": system_prompt})

            # Format messages for OpenAI (converts images to image_url format)
            for msg in messages:
                formatted_msg = format_for_openai(msg)
                formatted_messages.append(formatted_msg)

            payload = {
                "model": self.model,
                "messages": formatted_messages,
                "stream": True,
            }

            async with self._client.stream(
                "POST", "/chat/completions", json=payload
            ) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if line.startswith("data: ") and line != "data: [DONE]":
                        try:
                            data = orjson.loads(line[6:])
                            delta = data["choices"][0].get("delta", {})
                            if "content" in delta and delta["content"]:
                                yield StreamChunk(
                                    provider=self.name, content=delta["content"]
                                )
                        except orjson.JSONDecodeError as e:
                            self._log_json_error(e)
                            continue
                    elif line == "data: [DONE]":
                        yield StreamChunk(provider=self.name, content="", is_done=True)

        except Exception as e:
            yield self._error_chunk(e)
