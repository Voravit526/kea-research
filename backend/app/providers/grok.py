from app.providers.base import OpenAIFormatProvider


class GrokProvider(OpenAIFormatProvider):
    """xAI Grok provider - uses OpenAI-compatible API."""

    name = "grok"
    base_url = "https://api.x.ai/v1"
