import os
from typing import List
from pydantic_settings import BaseSettings
from functools import lru_cache


def get_database_url() -> str:
    """Get database URL, converting postgres:// to postgresql+asyncpg:// if needed."""
    url = os.environ.get("DATABASE_URL", "sqlite+aiosqlite:///./crypto_chat.db")

    # Render uses postgres:// but SQLAlchemy needs postgresql://
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql+asyncpg://", 1)
    elif url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+asyncpg://", 1)

    return url


class Settings(BaseSettings):
    app_name: str = "Crypto Chat"
    debug: bool = False  # Set to False for production

    # Database - computed from environment
    database_url: str = get_database_url()

    # JWT
    secret_key: str = "your-secret-key-change-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    refresh_token_expire_days: int = 7

    # CORS - allow all origins for tunnel testing
    allowed_origins: List[str] = ["*"]

    class Config:
        env_file = ".env"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
