from app.providers.base import OpenAIFormatProvider


class MistralProvider(OpenAIFormatProvider):
    """Mistral AI provider."""

    name = "mistral"
    base_url = "https://api.mistral.ai/v1"
