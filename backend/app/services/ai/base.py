"""Base AI service interface and common types."""
from abc import ABC, abstractmethod
from typing import AsyncGenerator, List, Optional

from app.schemas.ai import ChatContext, ChatOptions, Message


class AIService(ABC):
    """Abstract base class for AI service implementations."""

    def __init__(
        self,
        base_url: str,
        api_key: str = "",
        timeout: int = 120,
    ):
        """Initialize AI service.

        Args:
            base_url: Base URL for the AI API
            api_key: API key for authentication (empty for local providers)
            timeout: Request timeout in seconds
        """
        self.base_url = base_url
        self.api_key = api_key
        self.timeout = timeout

    @abstractmethod
    async def chat(
        self,
        messages: List[Message],
        model: str,
        context: Optional[ChatContext] = None,
        options: Optional[ChatOptions] = None,
    ) -> AsyncGenerator[str, None]:
        """Send chat request and yield streaming response chunks.

        Args:
            messages: List of chat messages
            model: Model name to use
            context: Optional document context
            options: Chat options (temperature, max_tokens, etc.)

        Yields:
            str: Response content chunks

        Raises:
            AIServiceException: If the API call fails
        """
        pass

    @abstractmethod
    def get_models(self) -> List[str]:
        """Get list of available models for this provider.

        Returns:
            List of model names
        """
        pass

    @abstractmethod
    def supports_thinking_mode(self) -> bool:
        """Check if provider supports thinking mode.

        Returns:
            bool: True if thinking mode is supported
        """
        pass

    def _build_messages_with_context(
        self,
        messages: List[Message],
        context: Optional[ChatContext],
    ) -> List[dict]:
        """Build messages list with context injection.

        Args:
            messages: Original messages
            context: Optional document context

        Returns:
            List of message dicts for API
        """
        # For now, just convert to dict
        # In a full implementation, this would inject context into @syntax
        api_messages = []

        for msg in messages:
            content = msg.content

            # Handle @syntax for context injection
            if context and "@" in content:
                content = self._process_at_syntax(content, context)

            api_messages.append({
                "role": msg.role,
                "content": content,
            })

        return api_messages

    def _process_at_syntax(self, content: str, context: ChatContext) -> str:
        """Process @syntax in content and replace with context.

        Args:
            content: Content with @syntax
            context: Document context

        Returns:
            Processed content
        """
        import re

        # @selection - replace with selected text
        if context.selection:
            content = re.sub(
                r"@selection\b",
                f"```\n{context.selection.text}\n```",
                content,
            )

        # @document - replace with full document
        if context.document:
            content = re.sub(
                r"@document\b",
                f"```\n{context.document}\n```",
                content,
            )

        # @cursor - replace with cursor position context
        if context.cursor_position > 0:
            cursor_context = self._get_cursor_context(context)
            content = re.sub(
                r"@cursor\b",
                f"Cursor position context:\n```\n{cursor_context}\n```",
                content,
            )

        return content

    def _get_cursor_context(self, context: ChatContext) -> str:
        """Get context around cursor position.

        Args:
            context: Document context

        Returns:
            Context string around cursor
        """
        doc = context.document
        pos = context.cursor_position

        # Get 100 characters before and after cursor
        start = max(0, pos - 100)
        end = min(len(doc), pos + 100)

        return doc[start:end]
