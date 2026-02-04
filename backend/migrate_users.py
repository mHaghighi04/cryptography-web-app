#!/usr/bin/env python3
"""
Migration script to import existing users from crypto.json to the new database.

Note: Users migrated from crypto.json will have `requires_key_migration=True`
because the private key encryption format differs between Python (PKCS8 with Scrypt)
and Web Crypto API (AES-GCM with Scrypt-derived key).

On first login in the web app, users will need to re-enter their password to
re-encrypt their private key in the Web Crypto compatible format.
"""

import json
import asyncio
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from sqlalchemy import select
from app.database import AsyncSessionLocal, init_db
from app.models import User


async def migrate_users(crypto_json_path: str):
    """Migrate users from crypto.json to SQLite database."""

    # Load existing users
    crypto_path = Path(crypto_json_path)
    if not crypto_path.exists():
        print(f"Error: {crypto_json_path} not found")
        return

    with open(crypto_path, 'r') as f:
        crypto_data = json.load(f)

    # Initialize database
    await init_db()

    async with AsyncSessionLocal() as db:
        migrated = 0
        skipped = 0

        for username, user_data in crypto_data.items():
            # Check if user already exists
            result = await db.execute(select(User).where(User.username == username))
            existing = result.scalar_one_or_none()

            if existing:
                print(f"Skipping {username}: already exists in database")
                skipped += 1
                continue

            try:
                # Create user with migration flag
                user = User(
                    username=username,
                    salt=user_data.get('salt', ''),
                    password_hash=user_data.get('password_hash', ''),
                    encrypted_private_key=user_data.get('encrypted_private_key', ''),
                    public_key=user_data.get('public_key', ''),
                    requires_key_migration=True,  # Mark for key re-encryption on first login
                )

                db.add(user)
                print(f"Migrating user: {username}")
                migrated += 1

            except Exception as e:
                print(f"Error migrating {username}: {e}")

        await db.commit()
        print(f"\nMigration complete: {migrated} migrated, {skipped} skipped")


if __name__ == "__main__":
    # Default path relative to this script
    default_path = Path(__file__).parent.parent / "crypto.json"

    if len(sys.argv) > 1:
        crypto_path = sys.argv[1]
    else:
        crypto_path = str(default_path)

    print(f"Migrating users from: {crypto_path}")
    asyncio.run(migrate_users(crypto_path))
