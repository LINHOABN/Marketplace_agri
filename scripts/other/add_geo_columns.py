import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

from pathlib import Path
load_dotenv(Path(__file__).resolve().parents[2] / "backend-python" / ".env")
db_url = os.getenv('DATABASE_URL')
engine = create_engine(db_url)

with engine.connect() as conn:
    print("Adding latitude/longitude columns...")
    conn.execute(text("ALTER TABLE products ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION"))
    conn.execute(text("ALTER TABLE products ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION"))
    conn.commit()
    print("Columns added successfully.")
