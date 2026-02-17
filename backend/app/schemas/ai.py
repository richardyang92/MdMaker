"""AI-related Pydantic schemas."""
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class Message(BaseModel):
    """Chat message schema."""

    role: str = Field(..., description="Message role: system, user, or assistant")
    content: str = Field(..., description="Message content")


class SelectionContext(BaseModel):
    """Selection context for @syntax."""

    text: str = Field(..., description="Selected text")
    start: int = Field(..., description="Selection start position")
    end: int = Field(..., description="Selection end position")


class ChatContext(BaseModel):
    """Context for AI chat request."""

    document: str = Field(default="", description="Full document content")
    selection: Optional[SelectionContext] = Field(None, description="Selection context")
    cursor_position: int = Field(default=0, description="Cursor position in document")


class ChatOptions(BaseModel):
    """Options for AI chat request."""

    temperature: Optional[float] = Field(0.7, ge=0, le=2, description="Temperature for generation")
    max_tokens: Optional[int] = Field(4000, ge=1, description="Maximum tokens to generate")
    thinking_mode: Optional[bool] = Field(False, description="Enable thinking mode (DeepSeek)")
    stream: Optional[bool] = Field(True, description="Enable streaming response")


class ChatRequest(BaseModel):
    """Request schema for AI chat endpoint."""

    provider: str = Field(..., description="AI provider: deepseek or ollama")
    model: str = Field(..., description="Model name")
    messages: List[Message] = Field(..., min_length=1, description="Chat messages")
    context: Optional[ChatContext] = Field(None, description="Document context")
    options: Optional[ChatOptions] = Field(default_factory=ChatOptions, description="Chat options")


class ChatChunk(BaseModel):
    """Streaming response chunk."""

    type: str = Field(..., description="Chunk type: content, error, or done")
    content: str = Field(default="", description="Chunk content")
    error: Optional[str] = Field(None, description="Error message if type is error")


class ProviderInfo(BaseModel):
    """AI provider information."""

    name: str = Field(..., description="Provider display name")
    models: List[str] = Field(..., description="Available models")
    requires_key: bool = Field(..., description="Whether provider requires API key")
    supports_thinking_mode: bool = Field(False, description="Support for thinking mode")


class ProvidersResponse(BaseModel):
    """Response schema for providers endpoint."""

    providers: Dict[str, ProviderInfo] = Field(..., description="Available providers")
    default_provider: str = Field(..., description="Default provider name")


class ConfigStatusResponse(BaseModel):
    """Response schema for config status endpoint."""

    configured: bool = Field(..., description="Whether provider is configured")
    provider: str = Field(..., description="Current provider name")
    model: str = Field(..., description="Current model name")
    features: List[str] = Field(default_factory=list, description="Supported features")
