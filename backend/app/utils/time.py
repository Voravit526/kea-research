"""
Time utilities for KEA backend.
"""

from datetime import datetime, timezone


def utcnow() -> datetime:
    """Get current UTC time (timezone-aware, Python 3.12+ compatible)."""
    return datetime.now(timezone.utc)
