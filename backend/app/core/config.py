"""Application configuration management."""

from functools import lru_cache
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Server
    port: int = 8000
    environment: str = "development"

    # Database
    database_url: str = "postgresql://user:password@localhost:5432/mdmaker"

    # AI Providers
    deepseek_base_url: str = "https://api.deepseek.com/v1"
    deepseek_api_key: str = ""
    ollama_base_url: str = "http://localhost:11434/v1"

    # Default Configuration
    default_ai_provider: str = "ollama"

    # CORS
    cors_origins: str = "http://localhost:5173,http://localhost:3000,http://localhost:3001"

    # Rate Limiting
    rate_limit_per_minute: int = 60

    # Agent
    agent_max_iterations: int = 15
    agent_max_tool_failures: int = 3
    agent_max_doc_edit_ratio: float = 0.5
    agent_system_prompt: str = (
        "You are a document editing agent. You edit a Markdown document by calling tools. "
        "Always use the provided tools to read and modify the document. "
        "Prefer targeted edits (replace_section, find_replace) over rewriting the whole document.\n\n"
        "Tool semantics — read carefully to avoid common mistakes:\n"
        "- `set_title` only changes the document's stored title metadata. It does NOT create or "
        "match any heading inside the document body, so you cannot use the title as a heading "
        "argument to other tools.\n"
        "- Headings passed to `get_section` / `replace_section` / `insert_text(after_heading=...)` "
        "must be the PLAIN TEXT of an existing heading WITHOUT the leading '#' marks — for a line "
        "'## 下周计划' pass the string '下周计划'. Use `get_document_outline` first to see the exact "
        "heading text the tools expect. If a heading does not exist, create it first by inserting text.\n"
        "- Before editing a section you have not seen this turn, call `get_section` or "
        "`get_document_outline` to read it; do not guess its content.\n\n"
        "If you cannot fulfill the request (e.g. a referenced section does not exist and the user "
        "did not ask to create it), do NOT silently do nothing — briefly tell the user what was "
        "missing and what you did instead. After completing the user's request, respond with a "
        "short summary of what you changed."
    )

    @property
    def cors_origins_list(self) -> List[str]:
        """Parse CORS origins into a list."""
        return [origin.strip() for origin in self.cors_origins.split(",")]


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
