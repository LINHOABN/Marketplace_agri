"""
Migration KYC et Verification — Ajoute les champs d'identité et de statut vérifié.
Exécution : python migrations/002_kyc_verification.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import text
from database import engine

STATEMENTS = [
    # 1. Ajout des champs KYC aux utilisateurs
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS id_card_url TEXT;",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS selfie_url TEXT;",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_submitted_at TIMESTAMP;",
    
    # 2. Ajout de champs de statut à la boutique si nécessaire
    "ALTER TABLE shops ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active';",
    
    # 3. Historique des audits pour les décisions admin
    """
    CREATE TABLE IF NOT EXISTS kyc_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id),
        admin_id UUID REFERENCES users(id),
        action VARCHAR(50), -- 'approve', 'reject'
        note TEXT,
        created_at TIMESTAMP DEFAULT NOW()
    );
    """
]

def run():
    with engine.connect() as conn:
        for stmt in STATEMENTS:
            try:
                conn.execute(text(stmt))
                conn.commit()
                print("OK:", stmt.strip()[:60], "...")
            except Exception as e:
                print("ERR:", e)
    print("Migration KYC terminée.")

if __name__ == "__main__":
    run()
