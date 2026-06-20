import psycopg2
from psycopg2.extras import RealDictCursor
import os
from dotenv import load_dotenv
load_dotenv()

conn = psycopg2.connect(os.getenv('DATABASE_URL'))
cur = conn.cursor(cursor_factory=RealDictCursor)
pid = 'f7798244-9ab3-45b9-b0f1-71e4e7218994'

print('=== PRODUIT ===')
cur.execute('SELECT id, name, price FROM products WHERE id = %s', (pid,))
p = cur.fetchone()
if p:
    print(f"Nom: {p['name']} | Prix: {p['price']} FCFA")

print()
print('=== COMMANDES avec ce produit ===')
cur.execute("""
    SELECT o.id, o.total_amount, o.status, o.delivery_address, o.created_at,
           u.full_name as acheteur
    FROM orders o
    JOIN users u ON o.buyer_id = u.id
    WHERE o.product_id = %s
    ORDER BY o.created_at DESC LIMIT 5
""", (pid,))
orders = cur.fetchall()
if not orders:
    print("Aucune commande pour ce produit.")
for o in orders:
    print(f"Commande ID : {o['id']}")
    print(f"  Acheteur  : {o['acheteur']}")
    print(f"  Adresse   : {o['delivery_address']}")
    print(f"  Total     : {o['total_amount']} FCFA | Statut: {o['status']}")
    print(f"  Date      : {o['created_at']}")
    print()

cur.close()
conn.close()
