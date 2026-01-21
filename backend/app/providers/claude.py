import httpx
from typing import AsyncIterator, Optional

from app.providers.base import BaseProvider, StreamChunk


class ClaudeProvider(BaseProvider):
    name = "claude"

    def __init__(self, api_key: str, model: str):
        super().__init__(api_key, model)
        self._client = httpx.AsyncClient(
            base_url="https://api.anthropic.com/v1",
            headers={
                "x-api-key": self.api_key,
                "anthropic-version": "2023-06-01",
                "Content-Type": "application/json",
            },
            timeout=self.timeout,
        )

    def _extract_content(self, data: dict) -> str | None:
        """Extract text content from Claude SSE data."""
        if data.get("type") == "content_block_delta":
            return data.get("delta", {}).get("text")
        return None

    def _is_done(self, data: dict) -> bool:
        """Check if Claude stream is done."""
        return data.get("type") == "message_stop"

    async def stream_chat(
        self, messages: list[dict], system_prompt: Optional[str] = None
    ) -> AsyncIterator[StreamChunk]:
        """Stream chat responses from Claude API with vision support."""
        try:
            # Prepare messages (Claude accepts our universal format directly)
            # Content can be string or array of content blocks
            prepared_messages = []
            for msg in messages:
                # Ensure content is in correct format
                content = msg.get("content")
                if isinstance(content, str):
                    # Text-only message
                    prepared_messages.append({"role": msg["role"], "content": content})
                elif isinstance(content, list):
                    # Multimodal message (text + images)
                    prepared_messages.append({"role": msg["role"], "content": content})
                else:
                    # Fallback
                    prepared_messages.append({"role": msg["role"], "content": str(content)})

            payload = {
                "model": self.model,
                "max_tokens": 4096,
                "messages": prepared_messages,
                "stream": True,
            }
            if system_prompt:
                payload["system"] = system_prompt

            async with self._client.stream(
                "POST", "/messages", json=payload
            ) as response:
                response.raise_for_status()
                async for chunk in self._stream_sse_lines(
                    response, self._extract_content, self._is_done
                ):
                    yield chunk

        except Exception as e:
            yield self._error_chunk(e)
