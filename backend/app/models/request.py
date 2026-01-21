from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Literal, Union


class TextContent(BaseModel):
    """Text content part of a multimodal message"""
    type: Literal["text"] = "text"
    text: str


class ImageSource(BaseModel):
    """Image source with base64 data"""
    type: Literal["base64"] = "base64"
    media_type: str  # e.g., "image/jpeg", "image/png"
    data: str  # Base64-encoded image data (without data URL prefix)


class ImageContent(BaseModel):
    """Image content part of a multimodal message"""
    type: Literal["image"] = "image"
    source: ImageSource


class Message(BaseModel):
    """Message with either text-only (string) or multimodal (array) content"""
    role: str = Field(..., pattern="^(user|assistant)$")
    content: Union[str, List[Union[TextContent, ImageContent]]]

    model_config = ConfigDict(
        # Allow both formats for backward compatibility
        json_schema_extra={
            "examples": [
                {
                    "role": "user",
                    "content": "What is the capital of France?"
                },
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": "What's in this image?"},
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": "image/jpeg",
                                "data": "iVBORw0KGgoAAAANSUhEUgAA..."
                            }
                        }
                    ]
                }
            ]
        }
    )


class ChatRequest(BaseModel):
    messages: List[Message]
    system_prompt: Optional[str] = None
    providers: Optional[List[str]] = None  # If None, use all configured
    provider_set_id: Optional[int] = None  # If provided, use providers from this set
