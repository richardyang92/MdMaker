"""Configuration-related Pydantic schemas."""
from pydantic import BaseModel, Field


class ConfigValidateRequest(BaseModel):
    """Schema for validating AI provider configuration."""

    provider: str = Field(..., description="Provider name to validate")
    base_url: str = Field("", description="Base URL for the provider")
    api_key: str = Field("", description="API key for validation")
    model: str = Field(..., description="Model name to validate")


class ConfigValidateResponse(BaseModel):
    """Schema for configuration validation response."""

    valid: bool = Field(..., description="Whether configuration is valid")
    message: str = Field(..., description="Validation message")
    provider: str = Field(..., description="Provider name")
