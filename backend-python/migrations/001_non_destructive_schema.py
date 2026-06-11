"""
Migration non destructive — ajoute colonnes / tables manquantes sans DROP.
Exécution (depuis backend-python) : python migrations/001_non_destructive_schema.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import text
from database import engine

STATEMENTS = [
    """
    CREATE TABLE IF NOT EXISTS role_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id),
        requested_role VARCHAR(50) NOT NULL,
        status VARCHAR(30) DEFAULT 'pending',
        note TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP
    );
    """,
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;",
    "ALTER TABLE orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP;",
    "ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_vendor_id UUID;",
    "ALTER TABLE wallets ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;",
    "ALTER TABLE transactions ADD COLUMN IF NOT EXISTS user_id UUID;",
    "ALTER TABLE transactions ADD COLUMN IF NOT EXISTS description TEXT;",
    "ALTER TABLE transactions ADD COLUMN IF NOT EXISTS reference VARCHAR(255);",
    "ALTER TABLE transactions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP;",
    "ALTER TABLE notifications ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT FALSE;",
    "ALTER TABLE products ADD COLUMN IF NOT EXISTS media_urls TEXT[];",
    "ALTER TABLE products ADD COLUMN IF NOT EXISTS location VARCHAR(255);",
    "ALTER TABLE products ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;",
    "ALTER TABLE products ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;",
    "ALTER TABLE products ADD COLUMN IF NOT EXISTS managed_by_id UUID;",
    "ALTER TABLE disputes ADD COLUMN IF NOT EXISTS initiator_id UUID;",
    "ALTER TABLE disputes ADD COLUMN IF NOT EXISTS resolution TEXT;",
    "ALTER TABLE disputes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP;",
    """
    CREATE TABLE IF NOT EXISTS user_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        refresh_token_hash VARCHAR(128) NOT NULL,
        device_label VARCHAR(255),
        ip_address VARCHAR(64),
        user_agent TEXT,
        is_revoked BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW(),
        expires_at TIMESTAMP NOT NULL,
        last_used_at TIMESTAMP DEFAULT NOW()
    );
    """,
    "CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);",
    "CREATE INDEX IF NOT EXISTS idx_user_sessions_refresh_hash ON user_sessions(refresh_token_hash);",
]


def run():
    with engine.connect() as conn:
        for stmt in STATEMENTS:
            try:
                conn.execute(text(stmt))
                conn.commit()
                print("OK:", stmt.strip()[:60], "...")
            except Exception as e:
                print("SKIP/ERR:", e)
    print("Migration terminée.")


if __name__ == "__main__":
    run()
