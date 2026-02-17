"""Logging middleware."""
import time
from typing import Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware


class LoggingMiddleware(BaseHTTPMiddleware):
    """Middleware to log HTTP requests."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Process request and log details."""
        start_time = time.time()

        # Log request
        print(f"[{request.method}] {request.url.path}")

        # Process request
        response = await call_next(request)

        # Calculate duration
        duration = time.time() - start_time

        # Add custom header
        response.headers["X-Process-Time"] = str(duration)

        # Log response
        print(f"[{request.method}] {request.url.path} - {response.status_code} - {duration:.3f}s")

        return response
