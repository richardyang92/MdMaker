"""AI service factory for creating provider instances."""
from typing import Dict, Type

from app.core.config import get_settings
from app.core.exceptions import AIProviderNotConfiguredException
from app.services.ai.base import AIService

settings = get_settings()


# Registry of available AI services
_services: Dict[str, Type[AIService]] = {}


def register_ai_service(provider: str, service_class: Type[AIService]) -> None:
    """Register an AI service implementation.

    Args:
        provider: Provider name (e.g., 'deepseek', 'ollama')
        service_class: AI service implementation class
    """
    _services[provider.lower()] = service_class


def get_ai_service(provider: str) -> AIService:
    """Get an AI service instance for the given provider.

    Args:
        provider: Provider name

    Returns:
        AIService instance

    Raises:
        AIProviderNotConfiguredException: If provider is not registered
    """
    provider = provider.lower()

    if provider not in _services:
        raise AIProviderNotConfiguredException(provider)

    service_class = _services[provider]

    # Get provider configuration
    if provider == "deepseek":
        if not settings.deepseek_api_key:
            raise AIProviderNotConfiguredException(
                f"DeepSeek API key not configured"
            )
        return service_class(
            base_url=settings.deepseek_base_url,
            api_key=settings.deepseek_api_key,
        )
    elif provider == "ollama":
        return service_class(
            base_url=settings.ollama_base_url,
            api_key="",  # Ollama doesn't need API key
        )
    else:
        raise AIProviderNotConfiguredException(provider)


async def get_available_providers() -> Dict[str, Dict]:
    """Get information about all available providers.

    Returns:
        Dict mapping provider names to their info
    """
    # Import services here to avoid circular imports
    from app.services.ai.deepseek import DeepSeekService
    from app.services.ai.ollama import OllamaService

    # Fetch Ollama models dynamically
    ollama_models = await OllamaService.fetch_model_list(settings.ollama_base_url)

    return {
        "deepseek": {
            "name": "DeepSeek",
            "models": DeepSeekService.get_model_list(),
            "requires_key": True,
            "supports_thinking_mode": True,
        },
        "ollama": {
            "name": "Ollama",
            "models": ollama_models,
            "requires_key": False,
            "supports_thinking_mode": False,
        },
    }


def get_available_providers_sync() -> Dict[str, Dict]:
    """Get information about all available providers (synchronous version).

    Returns:
        Dict mapping provider names to their info
    """
    # Import services here to avoid circular imports
    from app.services.ai.deepseek import DeepSeekService
    from app.services.ai.ollama import OllamaService

    return {
        "deepseek": {
            "name": "DeepSeek",
            "models": DeepSeekService.get_model_list(),
            "requires_key": True,
            "supports_thinking_mode": True,
        },
        "ollama": {
            "name": "Ollama",
            "models": OllamaService.get_model_list(),
            "requires_key": False,
            "supports_thinking_mode": False,
        },
    }


def is_provider_configured(provider: str) -> bool:
    """Check if a provider is properly configured.

    Args:
        provider: Provider name

    Returns:
        bool: True if configured
    """
    provider = provider.lower()

    if provider == "deepseek":
        return bool(settings.deepseek_api_key)
    elif provider == "ollama":
        return True  # Ollama is always available if registered
    else:
        return provider in _services
