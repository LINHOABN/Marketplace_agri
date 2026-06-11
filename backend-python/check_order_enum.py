from database import engine
from sqlalchemy import text

with engine.connect() as conn:
    r = conn.execute(text("""
        SELECT enumlabel FROM pg_enum
        JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
        WHERE pg_type.typname = 'order_status'
        ORDER BY enumsortorder
    """)).mappings().all()
    print("=== Valeurs valides pour order_status ===")
    for row in r:
        print(f"  '{row['enumlabel']}'")
