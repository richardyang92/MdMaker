"""Document-related Pydantic schemas."""
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class DocumentCreate(BaseModel):
    """Schema for creating a new document."""

    title: str = Field(..., min_length=1, max_length=255, description="Document title")
    content: str = Field(default="", description="Document markdown content")


class DocumentUpdate(BaseModel):
    """Schema for updating a document."""

    title: Optional[str] = Field(None, min_length=1, max_length=255, description="Document title")
    content: Optional[str] = Field(None, description="Document markdown content")


class DocumentResponse(BaseModel):
    """Schema for document response."""

    id: str = Field(..., description="Document ID")
    title: str = Field(..., description="Document title")
    content: str = Field(..., description="Document content")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")

    class Config:
        """Pydantic config."""

        from_attributes = True


class DocumentListItem(BaseModel):
    """Schema for document list item."""

    id: str = Field(..., description="Document ID")
    title: str = Field(..., description="Document title")
    updated_at: datetime = Field(..., description="Last update timestamp")

    class Config:
        """Pydantic config."""

        from_attributes = True


class DocumentListResponse(BaseModel):
    """Schema for document list response."""

    documents: List[DocumentListItem] = Field(default_factory=list, description="List of documents")
