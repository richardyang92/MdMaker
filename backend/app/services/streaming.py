"""SSE (Server-Sent Events) streaming service."""
import json
from typing import AsyncGenerator

from app.schemas.ai import ChatChunk


async def create_sse_stream(
    content_generator: AsyncGenerator[str, None],
) -> AsyncGenerator[str, None]:
    """Create SSE stream from content generator.

    Args:
        content_generator: Async generator yielding content chunks

    Yields:
        SSE formatted strings
    """
    try:
        async for content in content_generator:
            # Send content chunk
            chunk = ChatChunk(type="content", content=content)
            yield format_sse_chunk(chunk.model_dump())

        # Send done signal
        done_chunk = ChatChunk(type="done", content="")
        yield format_sse_chunk(done_chunk.model_dump())

    except Exception as e:
        # Send error chunk
        error_chunk = ChatChunk(type="error", content="", error=str(e))
        yield format_sse_chunk(error_chunk.model_dump())


def format_sse_chunk(data: dict) -> str:
    """Format data as SSE chunk.

    Args:
        data: Data to send as JSON

    Returns:
        SSE formatted string
    """
    return f"data: {json.dumps(data, ensure_ascii=False)}\n\n"


async def aiter_chunks(content: str, chunk_size: int = 10) -> AsyncGenerator[str, None]:
    """Split content into chunks for streaming.

    Args:
        content: Content to chunk
        chunk_size: Characters per chunk

    Yields:
        Content chunks
    """
    for i in range(0, len(content), chunk_size):
        yield content[i:i + chunk_size]
