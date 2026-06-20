import psycopg2
from psycopg2.extras import RealDictCursor
import os
from dotenv import load_dotenv
load_dotenv()
conn = psycopg2.connect(os.getenv('DATABASE_URL'))
cur = conn.cursor(cursor_factory=RealDictCursor)

cur.execute("SELECT id, name, description, quantity_available FROM products")
rows = cur.fetchall()

print("=== Liste des produits en BDD ===")
for r in rows:
    print(f"- {r['name']} (Qté: {r['quantity_available']}) | {r['id']}")

cur.close()
conn.close()
