from typing import List
from pydantic_settings import BaseSettings
from pydantic import field_validator
from functools import lru_cache


def convert_database_url(url: str) -> str:
    """Convert postgres:// to postgresql+asyncpg:// for async SQLAlchemy."""
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql+asyncpg://", 1)
    elif url.startswith("postgresql://") and "+asyncpg" not in url:
        return url.replace("postgresql://", "postgresql+asyncpg://", 1)
    return url


class Settings(BaseSettings):
    app_name: str = "Crypto Chat"
    debug: bool = False  # Set to False for production

    # Database - pydantic will load DATABASE_URL from env, validator converts it
    database_url: str = "sqlite+aiosqlite:///./crypto_chat.db"

    # JWT
    secret_key: str = "your-secret-key-change-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    refresh_token_expire_days: int = 7

    # CORS - allow all origins for tunnel testing
    allowed_origins: List[str] = ["*"]

    @field_validator("database_url", mode="after")
    @classmethod
    def convert_db_url(cls, v: str) -> str:
        """Convert postgres:// URLs to async driver format after pydantic loads them."""
        return convert_database_url(v)

    class Config:
        env_file = ".env"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
