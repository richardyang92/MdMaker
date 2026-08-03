"""Pydantic schemas for the Agent API."""
from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field


class CreateSessionRequest(BaseModel):
    document: str = Field(default="", description="Initial document content")
    title: str = Field(default="Untitled", description="Initial document title")


class CreateSessionResponse(BaseModel):
    session_id: str
    version: int
    title: str


class SendMessageRequest(BaseModel):
    message: str = Field(..., min_length=1, description="User message to the agent")
    provider: str = Field(default="deepseek", description="AI provider")
    model: str = Field(..., description="Model name")
    selection: Optional[str] = Field(default=None, description="Selected text context (from @selection)")
    cursor_position: int = Field(default=0)


class ClientSyncRequest(BaseModel):
    base_version: int = Field(..., description="Version the client's edit is based on")
    content: str = Field(..., description="Full new document content from the client")


class ClientSyncResponse(BaseModel):
    status: str = Field(..., description="ok | conflict")
    version: int
    content: str
    title: str


class StopResponse(BaseModel):
    stopped: bool
