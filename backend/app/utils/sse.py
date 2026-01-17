import orjson
from typing import Optional


def format_sse(
    event: str, provider: str, data: str, error: Optional[str] = None
) -> str:
    """Format data as SSE event"""
    payload = {"provider": provider, "data": data}
    if error:
        payload["error"] = error

    return f"event: {event}\ndata: {orjson.dumps(payload).decode()}\n\n"


def format_pipeline_sse(event: str, provider: str, data: dict) -> str:
    """Format pipeline-specific SSE event with structured data"""
    payload = {"provider": provider, **data}
    return f"event: {event}\ndata: {orjson.dumps(payload).decode()}\n\n"
