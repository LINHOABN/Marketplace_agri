import os
import json
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

from pathlib import Path
load_dotenv(Path(__file__).resolve().parents[2] / "backend-python" / ".env")
db_url = os.getenv('DATABASE_URL')
engine = create_engine(db_url)

with engine.connect() as conn:
    print("--- Products Table Schema ---")
    res = conn.execute(text("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'products'"))
    for row in res.mappings().all():
        print(f"{row['column_name']}: {row['data_type']}")
