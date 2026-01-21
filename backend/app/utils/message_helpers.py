"""Message format conversion utilities for multi-provider image support."""

from typing import Any
import re


def has_images(message: dict[str, Any]) -> bool:
    """
    Check if a message contains images.

    Args:
        message: Message dict with 'content' field

    Returns:
        True if message contains image content blocks
    """
    content = message.get("content")
    if isinstance(content, str):
        return False
    if isinstance(content, list):
        return any(
            isinstance(item, dict) and item.get("type") == "image"
            for item in content
        )
    return False


def extract_text_only(message: dict[str, Any]) -> dict[str, Any]:
    """
    Strip images from message, return text-only version.

    Args:
        message: Message dict with 'content' field

    Returns:
        New message dict with only text content

    Examples:
        >>> msg = {"role": "user", "content": [{"type": "text", "text": "Hi"}, {"type": "image", ...}]}
        >>> extract_text_only(msg)
        {"role": "user", "content": "Hi"}

        >>> msg = {"role": "user", "content": "Plain text"}
        >>> extract_text_only(msg)
        {"role": "user", "content": "Plain text"}
    """
    content = message.get("content")

    # Already text-only
    if isinstance(content, str):
        return message.copy()

    # Extract text parts from multimodal content
    if isinstance(content, list):
        text_parts = []
        for item in content:
            if isinstance(item, dict) and item.get("type") == "text":
                text_parts.append(item.get("text", ""))

        # Join all text parts with newlines
        text_content = "\n".join(text_parts).strip()

        return {
            "role": message.get("role"),
            "content": text_content or "(image)"  # Fallback if only images
        }

    return message.copy()


def format_for_claude(message: dict[str, Any]) -> dict[str, Any]:
    """
    Convert message to Claude's format.

    Claude format for images:
    {
        "role": "user",
        "content": [
            {"type": "text", "text": "What's in this image?"},
            {
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": "image/jpeg",
                    "data": "iVBORw0KGgoAAAANSUhEUgAA..."  # No data URL prefix
                }
            }
        ]
    }

    Args:
        message: Universal format message

    Returns:
        Claude-formatted message
    """
    content = message.get("content")

    # Text-only: pass through
    if isinstance(content, str):
        return message.copy()

    # Multimodal: already in Claude format (our universal format matches Claude)
    if isinstance(content, list):
        return message.copy()

    return message.copy()


def format_for_openai(message: dict[str, Any]) -> dict[str, Any]:
    """
    Convert message to OpenAI format (also used by Mistral, Grok, OpenRouter).

    OpenAI format for images:
    {
        "role": "user",
        "content": [
            {"type": "text", "text": "What's in this image?"},
            {
                "type": "image_url",
                "image_url": {
                    "url": "data:image/jpeg;base64,iVBORw0KGgoAAAANSUhEUgAA..."
                }
            }
        ]
    }

    Args:
        message: Universal format message

    Returns:
        OpenAI-formatted message
    """
    content = message.get("content")

    # Text-only: pass through
    if isinstance(content, str):
        return message.copy()

    # Multimodal: convert to OpenAI format
    if isinstance(content, list):
        openai_content = []
        for item in content:
            if isinstance(item, dict):
                if item.get("type") == "text":
                    openai_content.append({
                        "type": "text",
                        "text": item.get("text", "")
                    })
                elif item.get("type") == "image":
                    # Convert from Claude format to OpenAI format
                    source = item.get("source", {})
                    media_type = source.get("media_type", "image/jpeg")
                    data = source.get("data", "")

                    # Reconstruct data URL
                    data_url = f"data:{media_type};base64,{data}"

                    openai_content.append({
                        "type": "image_url",
                        "image_url": {
                            "url": data_url
                        }
                    })

        return {
            "role": message.get("role"),
            "content": openai_content
        }

    return message.copy()


def format_for_gemini(message: dict[str, Any]) -> dict[str, Any]:
    """
    Convert message to Gemini format.

    Gemini format for images:
    {
        "role": "user",  # Note: will be converted to "user"/"model" by provider
        "parts": [
            {"text": "What's in this image?"},
            {
                "inline_data": {
                    "mime_type": "image/jpeg",
                    "data": "iVBORw0KGgoAAAANSUhEUgAA..."  # No data URL prefix
                }
            }
        ]
    }

    Args:
        message: Universal format message

    Returns:
        Gemini-formatted message (intermediate format, provider will finalize)
    """
    content = message.get("content")

    # Text-only: return as single text part
    if isinstance(content, str):
        return {
            "role": message.get("role"),
            "parts": [{"text": content}]
        }

    # Multimodal: convert to Gemini parts format
    if isinstance(content, list):
        gemini_parts = []
        for item in content:
            if isinstance(item, dict):
                if item.get("type") == "text":
                    gemini_parts.append({
                        "text": item.get("text", "")
                    })
                elif item.get("type") == "image":
                    # Convert from Claude format to Gemini format
                    source = item.get("source", {})
                    gemini_parts.append({
                        "inline_data": {
                            "mime_type": source.get("media_type", "image/jpeg"),
                            "data": source.get("data", "")
                        }
                    })

        return {
            "role": message.get("role"),
            "parts": gemini_parts
        }

    return message.copy()


def get_mime_type_from_data_url(data_url: str) -> str:
    """
    Extract MIME type from data URL.

    Args:
        data_url: Base64 data URL (e.g., "data:image/jpeg;base64,...")

    Returns:
        MIME type string (e.g., "image/jpeg")

    Examples:
        >>> get_mime_type_from_data_url("data:image/png;base64,iVBORw0...")
        "image/png"
        >>> get_mime_type_from_data_url("invalid")
        "image/jpeg"  # Default fallback
    """
    match = re.match(r'data:([^;]+);base64,', data_url)
    if match:
        return match.group(1)
    return "image/jpeg"  # Default fallback


def split_data_url(data_url: str) -> tuple[str, str]:
    """
    Split data URL into MIME type and base64 data.

    Args:
        data_url: Base64 data URL

    Returns:
        Tuple of (mime_type, base64_data)

    Examples:
        >>> split_data_url("data:image/png;base64,iVBORw0...")
        ("image/png", "iVBORw0...")
    """
    parts = data_url.split(',', 1)
    if len(parts) == 2:
        mime_type = get_mime_type_from_data_url(data_url)
        return mime_type, parts[1]
    return "image/jpeg", data_url  # Fallback
