from database import engine
from sqlalchemy import text

with engine.connect() as conn:
    # Check transactions columns
    print("=== TRANSACTIONS COLUMNS ===")
    r = conn.execute(text("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'transactions'")).mappings().all()
    for row in r:
        print(f"{row['column_name']}: {row['data_type']}")
    
    # Check transaction types if it's an enum
    print("\n=== TRANSACTION TYPES ===")
    try:
        r = conn.execute(text("SELECT enumlabel FROM pg_enum JOIN pg_type ON pg_enum.enumtypid = pg_type.oid WHERE pg_type.typname = 'transaction_type'")).mappings().all()
        for row in r:
            print(f"  '{row['enumlabel']}'")
    except:
        print("Could not find transaction_type enum")

    # Check transaction statuses
    print("\n=== TRANSACTION STATUSES ===")
    try:
        r = conn.execute(text("SELECT enumlabel FROM pg_enum JOIN pg_type ON pg_enum.enumtypid = pg_type.oid WHERE pg_type.typname = 'transaction_status'")).mappings().all()
        for row in r:
            print(f"  '{row['enumlabel']}'")
    except:
        print("Could not find transaction_status enum")
