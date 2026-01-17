from app.providers.base import OpenAIFormatProvider


class OpenAIProvider(OpenAIFormatProvider):
    """OpenAI GPT provider."""

    name = "openai"
    base_url = "https://api.openai.com/v1"
