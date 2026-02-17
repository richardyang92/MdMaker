"""FastAPI application entry point."""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import get_settings
from app.core.exceptions import AppException
from app.middleware.error_handler import add_exception_handlers
from app.middleware.logging import LoggingMiddleware

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager."""
    # Startup
    print(f"Starting MdMaker Backend API in {settings.environment} mode...")
    yield
    # Shutdown
    print("Shutting down MdMaker Backend API...")


# Create FastAPI application
app = FastAPI(
    title="MdMaker Backend API",
    description="Backend API for AI-powered Markdown Editor",
    version="0.1.0",
    lifespan=lifespan,
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add custom middleware
app.add_middleware(LoggingMiddleware)

# Add exception handlers
add_exception_handlers(app)


# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "ok",
        "environment": settings.environment,
        "version": "0.1.0",
    }


# Include API routers
from app.api.v1 import ai, config, documents

app.include_router(ai.router, prefix="/api/v1/ai", tags=["AI"])
app.include_router(config.router, prefix="/api/v1/config", tags=["Config"])
app.include_router(documents.router, prefix="/api/v1/documents", tags=["Documents"])


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "message": "MdMaker Backend API",
        "version": "0.1.0",
        "docs": "/docs",
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=settings.port,
        reload=settings.environment == "development",
    )
