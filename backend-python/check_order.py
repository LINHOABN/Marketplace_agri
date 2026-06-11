from database import engine
from sqlalchemy import text
import sys

order_id = "062457af-f52b-447c-92cd-7b057443bb5f"

with engine.connect() as conn:
    r = conn.execute(text("SELECT id, status FROM orders WHERE id = CAST(:id AS uuid)"), {"id": order_id}).mappings().first()
    if r:
        print(f"FOUND: ID={r['id']}, Status={r['status']}")
    else:
        print("NOT FOUND")
