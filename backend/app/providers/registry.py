import asyncio
import logging
from typing import Dict, List, Optional, Type

from app.providers.base import BaseProvider

logger = logging.getLogger(__name__)
from app.providers.claude import ClaudeProvider
from app.providers.openai import OpenAIProvider
from app.providers.gemini import GeminiProvider
from app.providers.mistral import MistralProvider
from app.providers.grok import GrokProvider
from app.providers.openrouter import OpenRouterProvider
from app.providers.openai_compatible import OpenAICompatibleProvider


# Mapping of provider types to their classes
PROVIDER_CLASSES: Dict[str, Type[BaseProvider]] = {
    "anthropic": ClaudeProvider,
    "openai": OpenAIProvider,
    "google": GeminiProvider,
    "mistral": MistralProvider,
    "xai": GrokProvider,
    "openrouter": OpenRouterProvider,
    "openai-compatible": OpenAICompatibleProvider,
}


class ProviderRegistry:
    """Central registry for AI providers - loads from database"""

    # Maximum time to wait for active streams during cleanup (seconds)
    CLEANUP_TIMEOUT = 10.0

    def __init__(self):
        self._providers: Dict[str, BaseProvider] = {}
        self._active_streams: int = 0
        self._lock = asyncio.Lock()

    def stream_started(self) -> None:
        """Call when a provider stream starts."""
        self._active_streams += 1

    def stream_ended(self) -> None:
        """Call when a provider stream ends."""
        self._active_streams = max(0, self._active_streams - 1)

    async def initialize(self):
        """Initialize all configured providers from database"""
        from sqlalchemy import select
        from sqlalchemy.orm import selectinload

        from app.database import ProviderConfig, async_session

        async with async_session() as session:
            # Load active providers with their active default models
            stmt = (
                select(ProviderConfig)
                .where(ProviderConfig.is_active == True)
                .options(selectinload(ProviderConfig.models))
            )
            result = await session.execute(stmt)
            providers = result.scalars().all()

            for provider_config in providers:
                # Find the default active model for this provider
                default_model = None
                for model in provider_config.models:
                    if model.is_active and model.is_default:
                        default_model = model.model_id
                        break

                # If no default, use first active model
                if not default_model:
                    for model in provider_config.models:
                        if model.is_active:
                            default_model = model.model_id
                            break

                # Skip if no active model
                if not default_model:
                    continue

                # Get the provider class
                provider_class = PROVIDER_CLASSES.get(provider_config.provider_type)
                if not provider_class:
                    logger.warning(f"Unknown provider type '{provider_config.provider_type}'")
                    continue

                try:
                    # Create provider instance based on type
                    if provider_config.provider_type == "openai-compatible":
                        provider = OpenAICompatibleProvider(
                            api_key=provider_config.api_key,
                            model=default_model,
                            base_url=provider_config.base_url,
                            name=provider_config.name,
                        )
                    else:
                        # Standard providers
                        if not provider_config.api_key:
                            continue
                        provider = provider_class(
                            provider_config.api_key, default_model
                        )
                        # Override name for multi-instance support
                        provider.name = provider_config.name

                    self._providers[provider_config.name] = provider
                except Exception as e:
                    logger.error(f"Error initializing provider '{provider_config.name}': {e}")

    def get_provider(self, name: str) -> Optional[BaseProvider]:
        return self._providers.get(name)

    def get_active_providers(self) -> List[BaseProvider]:
        """Return all providers with valid API keys"""
        return [p for p in self._providers.values() if p.is_configured()]

    def get_provider_names(self) -> List[str]:
        """Return names of all configured providers"""
        return list(self._providers.keys())

    async def cleanup(self):
        """Cleanup all providers, waiting for active streams to complete."""
        # Wait for active streams to complete (with timeout)
        wait_time = 0.0
        while self._active_streams > 0 and wait_time < self.CLEANUP_TIMEOUT:
            logger.debug(f"Waiting for {self._active_streams} active streams to complete...")
            await asyncio.sleep(0.1)
            wait_time += 0.1

        if self._active_streams > 0:
            logger.warning(
                f"Cleanup timeout: {self._active_streams} streams still active after "
                f"{self.CLEANUP_TIMEOUT}s. Proceeding with cleanup."
            )

        # Cleanup all providers
        for provider in self._providers.values():
            try:
                await provider.cleanup()
            except Exception as e:
                logger.warning(f"Error cleaning up provider {provider.name}: {e}")
        self._providers.clear()


# Singleton instance
provider_registry = ProviderRegistry()
