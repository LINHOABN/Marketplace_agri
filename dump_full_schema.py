import os
import sys
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

# Absolute path to the .env file
env_path = r"C:\Users\Dr Haoua Madeleine\Desktop\5 - Copie - Copie\backend-python\.env"
print(f"Loading .env from: {env_path}")
load_dotenv(env_path)

db_url = os.getenv("DATABASE_URL")
if not db_url:
    print(f"DATABASE_URL not found in {env_path}")
    sys.exit(1)

print(f"Connecting to: {db_url}")
engine = create_engine(db_url)

def dump_schema():
    with engine.connect() as conn:
        # Get all table names
        tables_query = text("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_type = 'BASE TABLE'
            ORDER BY table_name;
        """)
        tables = conn.execute(tables_query).scalars().all()
        
        for table in tables:
            print(f"\n### TABLE: {table}")
            columns_query = text(f"""
                SELECT column_name, data_type, is_nullable, column_default
                FROM information_schema.columns 
                WHERE table_name = '{table}'
                ORDER BY ordinal_position;
            """)
            columns = conn.execute(columns_query).mappings().all()
            print("| Column | Type | Nullable | Default |")
            print("| --- | --- | --- | --- |")
            for col in columns:
                # Format default value to be more readable
                default = str(col['column_default']).replace("|", "\\|") if col['column_default'] is not None else ""
                print(f"| {col['column_name']} | {col['data_type']} | {col['is_nullable']} | {default} |")

if __name__ == "__main__":
    dump_schema()
