"""AI chat API routes."""
from typing import AsyncGenerator

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.schemas.ai import ChatRequest, ConfigStatusResponse, ProvidersResponse
from app.services.ai.factory import get_ai_service, get_available_providers
from app.services.streaming import create_sse_stream

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)


@router.post("/chat", description="Send message to AI with streaming response")
async def chat(request: ChatRequest):
    """Send chat message to AI provider.

    This endpoint streams responses using Server-Sent Events (SSE).
    """
    # Get AI service for the requested provider
    service = get_ai_service(request.provider)

    # Create content generator
    async def content_generator() -> AsyncGenerator[str, None]:
        async for chunk in service.chat(
            messages=request.messages,
            model=request.model,
            context=request.context,
            options=request.options,
        ):
            yield chunk

    # Return streaming response with SSE format
    return StreamingResponse(
        create_sse_stream(content_generator()),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get(
    "/providers",
    response_model=ProvidersResponse,
    description="Get available AI providers and models",
)
async def get_providers():
    """Get list of available AI providers and their models."""
    from app.core.config import get_settings

    settings = get_settings()
    providers = await get_available_providers()

    return ProvidersResponse(
        providers=providers,
        default_provider=settings.default_ai_provider,
    )


@router.get(
    "/status",
    response_model=ConfigStatusResponse,
    description="Get current AI configuration status",
)
async def get_status():
    """Get current AI configuration status."""
    from app.core.config import get_settings
    from app.services.ai.factory import is_provider_configured, get_available_providers

    settings = get_settings()
    provider = settings.default_ai_provider
    providers = await get_available_providers()

    # Get available features
    features = ["streaming", "@syntax"]
    if provider in providers:
        if providers[provider]["supports_thinking_mode"]:
            features.append("thinking_mode")

    return ConfigStatusResponse(
        configured=is_provider_configured(provider),
        provider=provider,
        model=providers[provider]["models"][0] if provider in providers else "",
        features=features,
    )
