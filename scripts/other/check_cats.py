import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

from pathlib import Path
load_dotenv(Path(__file__).resolve().parents[2] / "backend-python" / ".env")
db_url = os.getenv('DATABASE_URL')
engine = create_engine(db_url)

with engine.connect() as conn:
    res = conn.execute(text('SELECT id, name FROM categories'))
    for row in res.mappings().all():
        print(f"{row['id']}: {row['name']}")
