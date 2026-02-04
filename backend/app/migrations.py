"""
Database migrations for adding new columns.
Run once on startup to ensure schema is up to date.
"""

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine


async def run_migrations(engine: AsyncEngine):
    """Add missing columns to database tables."""
    print("Starting database migrations...")

    migrations = [
        # Users table - certificate fields
        ("users.csr", "ALTER TABLE users ADD COLUMN IF NOT EXISTS csr TEXT;"),
        ("users.certificate", "ALTER TABLE users ADD COLUMN IF NOT EXISTS certificate TEXT;"),
        ("users.certificate_status", "ALTER TABLE users ADD COLUMN IF NOT EXISTS certificate_status VARCHAR(20) DEFAULT 'none';"),
        ("users.certificate_expires_at", "ALTER TABLE users ADD COLUMN IF NOT EXISTS certificate_expires_at TIMESTAMP;"),
        ("users.certificate_serial", "ALTER TABLE users ADD COLUMN IF NOT EXISTS certificate_serial VARCHAR(50);"),

        # Messages table - signature fields
        ("messages.signature", "ALTER TABLE messages ADD COLUMN IF NOT EXISTS signature TEXT;"),
        ("messages.encrypted_key_sender", "ALTER TABLE messages ADD COLUMN IF NOT EXISTS encrypted_key_sender TEXT;"),
        ("messages.encrypted_key_recipient", "ALTER TABLE messages ADD COLUMN IF NOT EXISTS encrypted_key_recipient TEXT;"),
    ]

    async with engine.begin() as conn:
        for name, migration in migrations:
            try:
                await conn.execute(text(migration))
                print(f"Migration OK: {name}")
            except Exception as e:
                print(f"Migration error for {name}: {e}")

    print("Database migrations complete!")
