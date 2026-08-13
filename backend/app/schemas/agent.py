"""Pydantic schemas for the Agent API."""

from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, Field


class CreateSessionRequest(BaseModel):
    document: str = Field(default="", description="Initial document content")
    title: str = Field(default="Untitled", description="Initial document title")


class CreateSessionResponse(BaseModel):
    session_id: str
    version: int
    title: str


class ContextItem(BaseModel):
    """A named document snippet attached to a message, referenced via ``@<ref>``.

    The frontend lets users attach multiple snippets from the rendered document
    (each gets an auto-assigned ref like ``ctx-1``) and reference them inline in
    the message with ``@ctx-1``. The backend expands those references into
    fenced Markdown blocks before handing the message to the agent.
    """

    ref: str = Field(
        ...,
        pattern=r"^[A-Za-z0-9][A-Za-z0-9_-]*$",
        max_length=64,
        description="Short reference token used in the message as @<ref>",
    )
    label: str = Field(default="", max_length=200, description="Human-readable snippet label")
    content: str = Field(..., max_length=200_000, description="Raw Markdown snippet content")


class SendMessageRequest(BaseModel):
    message: str = Field(..., min_length=1, description="User message to the agent")
    provider: str = Field(default="deepseek", description="AI provider")
    model: str = Field(..., description="Model name")
    selection: Optional[str] = Field(
        default=None, description="Selected text context (from @selection)"
    )
    cursor_position: int = Field(default=0)
    contexts: Optional[List[ContextItem]] = Field(
        default=None,
        description="Named context snippets referenced in the message via @<ref>",
    )


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
