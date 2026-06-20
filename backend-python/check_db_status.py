import psycopg2
from psycopg2.extras import RealDictCursor
import json
import os
from dotenv import load_dotenv

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")

def check_db():
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        print("\n=== SYSTEM DATABASE CHECK (agrimarche_db) ===")
        
        # 1. Check last 3 users
        print("\n--- DERNIERS UTILISATEURS (Table 'users') ---")
        cur.execute("SELECT id, full_name, email, created_at FROM users ORDER BY created_at DESC LIMIT 3")
        users = cur.fetchall()
        for u in users:
            print(f"ID: {u['id']} | Nom: {u['full_name']} | Email: {u['email']}")

        # 2. Check last 3 products
        print("\n--- DERNIERS PRODUITS (Table 'products') ---")
        cur.execute("SELECT id, name, price, shop_id FROM products ORDER BY id DESC LIMIT 3")
        prods = cur.fetchall()
        for p in prods:
            print(f"ID: {p['id']} | Produit: {p['name']} | Prix: {p['price']}")

        # 3. Check last 3 orders
        print("\n--- DERNIÈRES COMMANDES (Table 'orders') ---")
        cur.execute("SELECT id, buyer_id, product_id, total_amount, status, created_at FROM orders ORDER BY created_at DESC LIMIT 3")
        orders = cur.fetchall()
        if not orders:
            print("Aucune commande trouvée.")
        for o in orders:
            print(f"ID: {o['id']} | Total: {o['total_amount']} | Statut: {o['status']} | Date: {o['created_at']}")

        cur.close()
        conn.close()
    except Exception as e:
        print(f"ERROR connecting to DB: {e}")

if __name__ == "__main__":
    check_db()
