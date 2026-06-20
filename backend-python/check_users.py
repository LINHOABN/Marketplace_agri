import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()
url = os.getenv("DATABASE_URL")
engine = create_engine(url)

with engine.connect() as conn:
    result = conn.execute(text("SELECT id, full_name, phone, email FROM users LIMIT 10"))
    for row in result:
        print(row)
