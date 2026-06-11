import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path('backend-python/.env'))
db_url = os.getenv('DATABASE_URL')
engine = create_engine(db_url)

with engine.connect() as con:
    for table in ['user_roles', 'role_requests', 'users', 'orders']:
        print(f"--- {table} ---")
        res = con.execute(text(f"SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '{table}'"))
        for row in res.mappings().all():
            print(f"{row['column_name']}: {row['data_type']}")
    
    print("\n--- Custom Types ---")
    res = con.execute(text("SELECT n.nspname as schema, t.typname as type FROM pg_type t LEFT JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace WHERE (t.typrelid = 0 OR (SELECT c.relkind = 'c' FROM pg_catalog.pg_class c WHERE c.oid = t.typrelid)) AND NOT EXISTS(SELECT 1 FROM pg_catalog.pg_type el WHERE el.oid = t.typelem AND el.typarray = t.oid) AND n.nspname NOT IN ('pg_catalog', 'information_schema')"))
    for row in res.mappings().all():
        print(f"{row['schema']}.{row['type']}")
