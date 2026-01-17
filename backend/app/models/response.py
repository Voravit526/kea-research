from pydantic import BaseModel
from typing import Optional


class SSEEvent(BaseModel):
    """SSE event structure for multi-provider streaming"""

    event: str  # "chunk", "done", "error"
    provider: str
    data: str
    error: Optional[str] = None
