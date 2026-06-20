import psycopg2
from psycopg2.extras import RealDictCursor
import os
from dotenv import load_dotenv
load_dotenv()
conn = psycopg2.connect(os.getenv('DATABASE_URL'))
cur = conn.cursor(cursor_factory=RealDictCursor)

# Recherche de produits réels
query_term = 'Tomates' # Un terme qui devrait exister
cur.execute("""
    SELECT p.id, p.name, p.price, c.name as category_name
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.name ILIKE %s
""", (f'%{query_term}%',))
results = cur.fetchall()

print(f"=== Recherche DB pour '{query_term}' ===")
if results:
    for r in results:
        print(f"ID: {r['id']} | Nom: {r['name']} | Prix: {r['price']}")
else:
    print("Aucun produit trouvé en DB.")

cur.close()
conn.close()
