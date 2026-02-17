"""Custom exceptions for the application."""
from typing import Any


class AppException(Exception):
    """Base exception for application errors."""

    def __init__(self, message: str, status_code: int = 500, details: Any = None):
        self.message = message
        self.status_code = status_code
        self.details = details
        super().__init__(self.message)


class AIServiceException(AppException):
    """Exception raised when AI service fails."""

    def __init__(self, message: str, details: Any = None):
        super().__init__(message, status_code=500, details=details)


class AIProviderNotConfiguredException(AppException):
    """Exception raised when AI provider is not configured."""

    def __init__(self, provider: str):
        message = f"AI provider '{provider}' is not configured"
        super().__init__(message, status_code=500)


class ValidationException(AppException):
    """Exception raised for validation errors."""

    def __init__(self, message: str, details: Any = None):
        super().__init__(message, status_code=422, details=details)


class DocumentNotFoundException(AppException):
    """Exception raised when document is not found."""

    def __init__(self, document_id: str):
        message = f"Document with id '{document_id}' not found"
        super().__init__(message, status_code=404)


class RateLimitException(AppException):
    """Exception raised when rate limit is exceeded."""

    def __init__(self):
        message = "Rate limit exceeded, please try again later"
        super().__init__(message, status_code=429)
