"""Ollama AI service implementation using official Ollama SDK."""
from typing import AsyncGenerator, List, Optional

import httpx
import ollama

from app.core.config import get_settings
from app.core.exceptions import AIServiceException
from app.schemas.ai import ChatContext, ChatOptions, Message
from app.services.ai.base import AIService
from app.services.ai.factory import register_ai_service

settings = get_settings()


class OllamaService(AIService):
    """Ollama AI service implementation using official Ollama SDK."""

    # Default models as fallback if API call fails
    DEFAULT_MODELS = ["qwen2.5:7b", "llama3.1:8b", "gemma2:9b", "mistral:7b"]

    def __init__(self, base_url: str, api_key: str = "", timeout: int = 300):
        """Initialize Ollama service.

        Args:
            base_url: Base URL for Ollama API (e.g., http://localhost:11434)
            api_key: Not used for Ollama (kept for interface consistency)
            timeout: Request timeout in seconds (longer for local models)
        """
        super().__init__(base_url, "", timeout)

        # Extract host from base_url (remove /v1 suffix if present)
        host = base_url.replace("/v1", "").replace("/api", "")

        # Initialize Ollama async client
        self.client = ollama.AsyncClient(host=host)

    async def chat(
        self,
        messages: List[Message],
        model: str,
        context: Optional[ChatContext] = None,
        options: Optional[ChatOptions] = None,
    ) -> AsyncGenerator[str, None]:
        """Send chat request to Ollama API and yield streaming chunks.

        Args:
            messages: List of chat messages
            model: Model name to use
            context: Optional document context
            options: Chat options

        Yields:
            str: Response content chunks

        Raises:
            AIServiceException: If the API call fails
        """
        if options is None:
            options = ChatOptions()

        # Build API request
        api_messages = self._build_messages_with_context(messages, context)

        # Convert to Ollama message format
        ollama_messages = [
            {"role": msg["role"], "content": msg["content"]}
            for msg in api_messages
        ]

        try:
            # Use the official SDK's chat method with streaming
            stream = await self.client.chat(
                model=model,
                messages=ollama_messages,
                stream=True,
                options={
                    "temperature": options.temperature,
                    "num_predict": options.max_tokens,
                },
            )

            async for chunk in stream:
                content = self._extract_content(chunk)
                if content:
                    yield content

        except ollama.ResponseError as e:
            raise AIServiceException(
                f"Ollama API error: {e.error}",
                details=str(e),
            )
        except ollama.ConnectError as e:
            raise AIServiceException(
                f"Cannot connect to Ollama - make sure Ollama is running at {self.base_url}",
                details=str(e),
            )
        except Exception as e:
            raise AIServiceException(f"Ollama API error: {str(e)}")

    def _extract_content(self, chunk: dict) -> Optional[str]:
        """Extract content from Ollama API response chunk.

        Args:
            chunk: Response chunk from API

        Returns:
            Content string or None
        """
        try:
            if chunk.get("done", False):
                return None
            return chunk.get("message", {}).get("content", "")
        except (KeyError, AttributeError):
            return None

    async def get_models(self) -> List[str]:
        """Get list of available Ollama models.

        Returns:
            List of model names
        """
        try:
            # Use Ollama client to list models
            models = await self.client.list()
            return [model["model"] for model in models.get("models", [])]
        except Exception as e:
            # Fallback to default models if API call fails
            return self.DEFAULT_MODELS.copy()

    def supports_thinking_mode(self) -> bool:
        """Check if Ollama supports thinking mode.

        Returns:
            bool: False for Ollama
        """
        return False

    @staticmethod
    async def fetch_model_list(base_url: str) -> List[str]:
        """Static method to fetch available models from Ollama API.

        Args:
            base_url: Base URL for Ollama API

        Returns:
            List of model names
        """
        try:
            # Extract host from base_url (remove /v1 suffix if present)
            host = base_url.replace("/v1", "").replace("/api", "")

            # Create async client
            client = ollama.AsyncClient(host=host)
            models = await client.list()
            return [model["model"] for model in models.get("models", [])]
        except Exception:
            # Fallback to default models if API call fails
            return OllamaService.DEFAULT_MODELS.copy()

    @staticmethod
    def get_model_list() -> List[str]:
        """Static method to get available models list.

        Note: This returns default models. For actual models, use fetch_model_list.

        Returns:
            List of model names
        """
        return OllamaService.DEFAULT_MODELS.copy()


# Register the service
register_ai_service("ollama", OllamaService)
