"""Document management API routes."""
from typing import List
from uuid import UUID, uuid4

from fastapi import APIRouter, HTTPException, status

from app.schemas.document import (
    DocumentCreate,
    DocumentListResponse,
    DocumentListItem,
    DocumentResponse,
    DocumentUpdate,
)

router = APIRouter()

# In-memory document storage (will be replaced with database in future)
_documents: dict = {}


@router.post(
    "",
    response_model=DocumentResponse,
    status_code=status.HTTP_201_CREATED,
    description="Create a new document",
)
async def create_document(data: DocumentCreate):
    """Create a new document."""
    from datetime import datetime

    doc_id = str(uuid4())
    now = datetime.utcnow()

    document = {
        "id": doc_id,
        "title": data.title,
        "content": data.content,
        "created_at": now,
        "updated_at": now,
    }

    _documents[doc_id] = document
    return document


@router.get(
    "",
    response_model=DocumentListResponse,
    description="Get list of all documents",
)
async def list_documents():
    """Get list of all documents."""
    docs = [
        DocumentListItem(
            id=doc["id"],
            title=doc["title"],
            updated_at=doc["updated_at"],
        )
        for doc in _documents.values()
    ]

    # Sort by updated_at descending
    docs.sort(key=lambda x: x.updated_at, reverse=True)

    return DocumentListResponse(documents=docs)


@router.get(
    "/{document_id}",
    response_model=DocumentResponse,
    description="Get a document by ID",
)
async def get_document(document_id: str):
    """Get a document by ID."""
    document = _documents.get(document_id)
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document '{document_id}' not found",
        )
    return document


@router.put(
    "/{document_id}",
    response_model=DocumentResponse,
    description="Update a document",
)
async def update_document(document_id: str, data: DocumentUpdate):
    """Update a document."""
    document = _documents.get(document_id)
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document '{document_id}' not found",
        )

    from datetime import datetime

    # Update fields
    if data.title is not None:
        document["title"] = data.title
    if data.content is not None:
        document["content"] = data.content

    document["updated_at"] = datetime.utcnow()

    return document


@router.delete(
    "/{document_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    description="Delete a document",
)
async def delete_document(document_id: str):
    """Delete a document."""
    if document_id not in _documents:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document '{document_id}' not found",
        )

    del _documents[document_id]
    return None
