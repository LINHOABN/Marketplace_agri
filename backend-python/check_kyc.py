from database import engine
from sqlalchemy import text

with engine.connect() as conn:
    r = conn.execute(text("SELECT id, full_name, id_card_url, selfie_url, verification_submitted_at FROM users WHERE id_card_url IS NOT NULL")).mappings().all()
    print(f"Found {len(r)} users with KYC docs")
    for row in r:
        print(f"ID: {row['id']} | Name: {row['full_name']} | ID Card: {row['id_card_url']} | Selfie: {row['selfie_url']} | Submitted: {row['verification_submitted_at']}")
