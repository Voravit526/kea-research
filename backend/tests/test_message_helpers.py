"""Tests for message helper utilities."""

import pytest
from app.utils.message_helpers import (
    has_images,
    extract_text_only,
    format_for_claude,
    format_for_openai,
    format_for_gemini,
    get_mime_type_from_data_url,
    split_data_url,
)


def test_has_images_text_only():
    msg = {"role": "user", "content": "Hello"}
    assert has_images(msg) == False


def test_has_images_with_image():
    msg = {
        "role": "user",
        "content": [
            {"type": "text", "text": "Hi"},
            {"type": "image", "source": {"type": "base64", "media_type": "image/jpeg", "data": "abc"}}
        ]
    }
    assert has_images(msg) == True


def test_extract_text_only_from_string():
    msg = {"role": "user", "content": "Hello"}
    result = extract_text_only(msg)
    assert result["content"] == "Hello"


def test_extract_text_only_from_multimodal():
    msg = {
        "role": "user",
        "content": [
            {"type": "text", "text": "Hello"},
            {"type": "image", "source": {}},
            {"type": "text", "text": "World"}
        ]
    }
    result = extract_text_only(msg)
    assert result["content"] == "Hello\nWorld"


def test_format_for_openai():
    msg = {
        "role": "user",
        "content": [
            {"type": "text", "text": "What's this?"},
            {
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": "image/png",
                    "data": "iVBORw0"
                }
            }
        ]
    }
    result = format_for_openai(msg)
    assert result["content"][0]["type"] == "text"
    assert result["content"][1]["type"] == "image_url"
    assert result["content"][1]["image_url"]["url"] == "data:image/png;base64,iVBORw0"


def test_format_for_gemini():
    msg = {
        "role": "user",
        "content": [
            {"type": "text", "text": "What's this?"},
            {
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": "image/jpeg",
                    "data": "abc123"
                }
            }
        ]
    }
    result = format_for_gemini(msg)
    assert "parts" in result
    assert result["parts"][0]["text"] == "What's this?"
    assert result["parts"][1]["inline_data"]["mime_type"] == "image/jpeg"
    assert result["parts"][1]["inline_data"]["data"] == "abc123"


def test_split_data_url():
    mime, data = split_data_url("data:image/png;base64,iVBORw0KGgo")
    assert mime == "image/png"
    assert data == "iVBORw0KGgo"
