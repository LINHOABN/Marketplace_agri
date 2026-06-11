from database import engine
from sqlalchemy import text

def check_defaults():
    with engine.connect() as conn:
        print("COLUMNS and DEFAULTS for 'conversations':")
        r = conn.execute(text("SELECT column_name, column_default, is_nullable FROM information_schema.columns WHERE table_name = 'conversations'")).mappings().all()
        for i in r:
            print(f"  {i['column_name']}: {i['column_default']} (Nullable: {i['is_nullable']})")

if __name__ == "__main__":
    check_defaults()
