from pydantic import BaseModel, Field
from typing import List, Optional


class Message(BaseModel):
    role: str = Field(..., pattern="^(user|assistant)$")
    content: str


class ChatRequest(BaseModel):
    messages: List[Message]
    system_prompt: Optional[str] = None
    providers: Optional[List[str]] = None  # If None, use all configured
    provider_set_id: Optional[int] = None  # If provided, use providers from this set
