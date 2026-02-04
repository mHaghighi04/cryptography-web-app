"""
Database migrations for adding new columns.
Run once on startup to ensure schema is up to date.
"""

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine


async def run_migrations(engine: AsyncEngine):
    """Add missing columns to database tables."""

    migrations = [
        # Users table - certificate fields
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS csr TEXT;",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS certificate TEXT;",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS certificate_status VARCHAR(20) DEFAULT 'none';",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS certificate_expires_at TIMESTAMP;",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS certificate_serial VARCHAR(50);",

        # Messages table - signature fields
        "ALTER TABLE messages ADD COLUMN IF NOT EXISTS signature TEXT;",
        "ALTER TABLE messages ADD COLUMN IF NOT EXISTS encrypted_key_sender TEXT;",
        "ALTER TABLE messages ADD COLUMN IF NOT EXISTS encrypted_key_recipient TEXT;",
    ]

    async with engine.begin() as conn:
        for migration in migrations:
            try:
                await conn.execute(text(migration))
                print(f"Migration OK: {migration[:50]}...")
            except Exception as e:
                # Column might already exist or other non-fatal error
                print(f"Migration skipped: {e}")

    print("Database migrations complete")
