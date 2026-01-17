import logging
import sys

from pydantic_settings import BaseSettings
from typing import Optional


def setup_logging():
    """Configure application logging."""
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        handlers=[logging.StreamHandler(sys.stdout)],
    )
    # Set third-party loggers to WARNING to reduce noise
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)


# Initialize logging on import
setup_logging()

logger = logging.getLogger(__name__)


class Settings(BaseSettings):
    # Admin authentication (REQUIRED - app will not start without this)
    admin_password: Optional[str] = None

    # Computed field: hashed admin password (set after initialization)
    _admin_password_hash: Optional[str] = None

    @property
    def admin_password_hash(self) -> Optional[str]:
        """Get the hashed admin password."""
        if self._admin_password_hash is None and self.admin_password:
            # Lazy import to avoid circular dependency with auth.py
            from app.utils.auth import hash_password
            self._admin_password_hash = hash_password(self.admin_password)
        return self._admin_password_hash

    # API Keys (server-side only)
    anthropic_api_key: Optional[str] = None
    openai_api_key: Optional[str] = None
    google_api_key: Optional[str] = None
    mistral_api_key: Optional[str] = None
    xai_api_key: Optional[str] = None
    openrouter_api_key: Optional[str] = None

    # Provider model configuration (defaults for initial seeding) 
    claude_model: str = "claude-sonnet-4-5-20250929"
    openai_model: str = "gpt-4.1"
    gemini_model: str = "gemini-2.5-pro"
    mistral_model: str = "mistral-large-latest"
    grok_model: str = "grok-4-1-fast-non-reasoning"

    # Server configuration
    host: str = "0.0.0.0"
    port: int = 8000
    debug: bool = False

    # Timeout settings (seconds)
    provider_timeout: int = 60

    # Admin session settings
    admin_token_expiry_hours: int = 24

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


def validate_admin_password():
    """Validate that ADMIN_PASSWORD is set. Raises SystemExit if not."""
    if not settings.admin_password:
        logger.error("=" * 60)
        logger.error("ADMIN_PASSWORD environment variable is required!")
        logger.error("=" * 60)
        logger.error("The KEA research application requires an admin password to be set.")
        logger.error("Please set ADMIN_PASSWORD in your .env file:")
        logger.error("    ADMIN_PASSWORD=your_secure_password_here")
        logger.error("=" * 60)
        sys.exit(1)


settings = Settings()
