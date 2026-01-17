"""
OpenRouter provider for accessing 300+ AI models through a unified API.

OpenRouter provides access to models from OpenAI, Anthropic, Google, Meta, and others
via an OpenAI-compatible API with additional headers for attribution.
"""

import httpx
import logging
from typing import Optional

from app.providers.base import BaseProvider, StreamChunk
import orjson

logger = logging.getLogger(__name__)


class OpenRouterProvider(BaseProvider):
    """OpenRouter provider - unified access to 300+ AI models.

    OpenRouter is OpenAI-compatible but requires HTTP-Referer and X-Title headers
    for proper attribution on their leaderboard.
    """

    name = "openrouter"
    base_url = "https://openrouter.ai/api/v1"

    @property
    def is_free_tier(self) -> bool:
        """OpenRouter free models (ending with :free) are slower and rate-limited."""
        return self.model.endswith(":free")

    def __init__(self, api_key: str, model: str):
        super().__init__(api_key, model)
        self._client = httpx.AsyncClient(
            base_url=self.base_url,
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
                # OpenRouter-specific headers for leaderboard attribution
                "HTTP-Referer": "https://kea.research",
                "X-Title": "KEA Research",
            },
            timeout=self.timeout,
        )

    async def stream_chat(
        self, messages: list[dict], system_prompt: Optional[str] = None
    ):
        """Stream chat completion using OpenRouter API (OpenAI-compatible format)."""
        try:
            formatted_messages = []
            if system_prompt:
                formatted_messages.append({"role": "system", "content": system_prompt})
            formatted_messages.extend(messages)

            payload = {
                "model": self.model,
                "messages": formatted_messages,
                "stream": True,
            }

            async with self._client.stream(
                "POST", "/chat/completions", json=payload
            ) as response:
                if response.status_code != 200:
                    # Read error response body for better debugging
                    error_body = await response.aread()
                    try:
                        error_json = orjson.loads(error_body)
                        error_msg = error_json.get("error", {}).get("message", str(error_body))
                    except orjson.JSONDecodeError:
                        error_msg = error_body.decode("utf-8", errors="replace")
                    logger.error(
                        f"OpenRouter API error for model '{self.model}': "
                        f"status={response.status_code}, error={error_msg}"
                    )
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