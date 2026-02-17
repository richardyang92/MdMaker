"""DeepSeek AI service implementation using OpenAI SDK."""
from typing import AsyncGenerator, List, Optional

from openai import AsyncOpenAI

from app.core.exceptions import AIServiceException
from app.schemas.ai import ChatContext, ChatOptions, Message
from app.services.ai.base import AIService
from app.services.ai.factory import register_ai_service


class DeepSeekService(AIService):
    """DeepSeek AI service implementation using OpenAI SDK.

    DeepSeek provides an OpenAI-compatible API, so we use the OpenAI SDK
    with the DeepSeek base URL.
    """

    MODELS = ["deepseek-chat", "deepseek-reasoner", "deepseek-coder"]

    def __init__(self, base_url: str, api_key: str, timeout: int = 120):
        """Initialize DeepSeek service.

        Args:
            base_url: Base URL for DeepSeek API
            api_key: DeepSeek API key
            timeout: Request timeout in seconds
        """
        super().__init__(base_url, api_key, timeout)
        if not api_key:
            raise AIServiceException("DeepSeek API key is required")

        # Initialize OpenAI client with DeepSeek base URL
        self.client = AsyncOpenAI(
            api_key=api_key,
            base_url=base_url,
            timeout=timeout,
        )

    async def chat(
        self,
        messages: List[Message],
        model: str,
        context: Optional[ChatContext] = None,
        options: Optional[ChatOptions] = None,
    ) -> AsyncGenerator[str, None]:
        """Send chat request to DeepSeek API and yield streaming chunks.

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

        # Prepare extra parameters for reasoning models
        extra_params = {}
        if options.thinking_mode and self.supports_thinking_mode():
            if "reasoner" in model.lower():
                # DeepSeek reasoner models have built-in reasoning
                pass

        try:
            stream = await self.client.chat.completions.create(
                model=model,
                messages=api_messages,
                stream=True,
                temperature=options.temperature,
                max_tokens=options.max_tokens,
                **extra_params,
            )

            async for chunk in stream:
                content = self._extract_content(chunk)
                if content:
                    yield content

        except Exception as e:
            raise AIServiceException(f"DeepSeek API error: {str(e)}")

    def _extract_content(self, chunk) -> Optional[str]:
        """Extract content from DeepSeek API response chunk.

        Args:
            chunk: Response chunk from API

        Returns:
            Content string or None
        """
        try:
            return chunk.choices[0].delta.content or ""
        except (AttributeError, IndexError):
            return None

    def get_models(self) -> List[str]:
        """Get list of available DeepSeek models.

        Returns:
            List of model names
        """
        return self.MODELS.copy()

    def supports_thinking_mode(self) -> bool:
        """Check if DeepSeek supports thinking mode.

        Returns:
            bool: True for DeepSeek
        """
        return True

    @staticmethod
    def get_model_list() -> List[str]:
        """Static method to get available models list.

        Returns:
            List of model names
        """
        return DeepSeekService.MODELS.copy()


# Register the service
register_ai_service("deepseek", DeepSeekService)
