import httpx
from typing import AsyncIterator, Optional

from app.providers.base import BaseProvider, StreamChunk


class GeminiProvider(BaseProvider):
    name = "gemini"

    def __init__(self, api_key: str, model: str):
        super().__init__(api_key, model)
        self._client = httpx.AsyncClient(
            base_url="https://generativelanguage.googleapis.com/v1beta",
            timeout=self.timeout,
        )

    def _extract_content(self, data: dict) -> str | None:
        """Extract text content from Gemini SSE data."""
        candidates = data.get("candidates", [])
        if candidates:
            parts = candidates[0].get("content", {}).get("parts", [])
            for part in parts:
                if text := part.get("text"):
                    return text
        return None

    async def stream_chat(
        self, messages: list[dict], system_prompt: Optional[str] = None
    ) -> AsyncIterator[StreamChunk]:
        try:
            # Convert messages to Gemini format
            contents = []
            for msg in messages:
                role = "user" if msg["role"] == "user" else "model"
                contents.append({"role": role, "parts": [{"text": msg["content"]}]})

            payload = {
                "contents": contents,
                "generationConfig": {"maxOutputTokens": 4096},
            }
            if system_prompt:
                payload["systemInstruction"] = {"parts": [{"text": system_prompt}]}

            url = f"/models/{self.model}:streamGenerateContent?key={self.api_key}&alt=sse"

            async with self._client.stream("POST", url, json=payload) as response:
                response.raise_for_status()
                async for chunk in self._stream_sse_lines(
                    response, self._extract_content
                ):
                    yield chunk

            # Gemini doesn't send explicit done signal, yield on stream end
            yield StreamChunk(provider=self.name, content="", is_done=True)

        except Exception as e:
            yield self._error_chunk(e)
