"""Configuration management API routes."""
from fastapi import APIRouter

from app.schemas.config import ConfigValidateRequest, ConfigValidateResponse
from app.services.ai.factory import get_ai_service, is_provider_configured

router = APIRouter()


@router.post(
    "/validate",
    response_model=ConfigValidateResponse,
    description="Validate AI provider configuration",
)
async def validate_config(request: ConfigValidateRequest):
    """Validate if the given provider configuration is valid.

    This endpoint checks if the API credentials are valid by attempting
    to connect to the provider's API.
    """
    try:
        # Check if provider is registered
        is_configured = is_provider_configured(request.provider)

        if not is_configured:
            return ConfigValidateResponse(
                valid=False,
                message=f"Provider '{request.provider}' is not configured",
                provider=request.provider,
            )

        # Try to get service (will raise if not configured properly)
        try:
            service = get_ai_service(request.provider)
            models = service.get_models()

            # Validate model name
            if request.model not in models:
                return ConfigValidateResponse(
                    valid=False,
                    message=f"Model '{request.model}' not available. Available: {', '.join(models)}",
                    provider=request.provider,
                )

            return ConfigValidateResponse(
                valid=True,
                message=f"Provider '{request.provider}' with model '{request.model}' is configured",
                provider=request.provider,
            )

        except Exception as e:
            return ConfigValidateResponse(
                valid=False,
                message=f"Configuration error: {str(e)}",
                provider=request.provider,
            )

    except Exception as e:
        return ConfigValidateResponse(
            valid=False,
            message=f"Validation failed: {str(e)}",
            provider=request.provider,
        )
