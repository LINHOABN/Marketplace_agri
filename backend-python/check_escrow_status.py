import psycopg2
from psycopg2.extras import RealDictCursor
import os
from dotenv import load_dotenv

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")

def check_escrow():
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        print("\n=== ÉTAT DES PORTEFEUILLES (Wallets) ===")
        cur.execute("""
            SELECT u.full_name, w.balance, w.escrow_balance, w.user_id 
            FROM wallets w
            JOIN users u ON w.user_id = u.id
            WHERE w.escrow_balance > 0 OR w.balance > 0
        """)
        wallets = cur.fetchall()
        if not wallets:
            print("Aucun portefeuille avec un solde (ou escrow) trouvé.")
        for w in wallets:
            print(f"User: {w['full_name']} | Balance: {w['balance']} | Escrow: {w['escrow_balance']}")

        print("\n=== TRANSACTIONS EN ATTENTE (Escrow Lock) ===")
        cur.execute("""
            SELECT t.id, t.amount, t.type, t.status, t.order_id, u.full_name as owner
            FROM transactions t
            JOIN wallets w ON t.wallet_id = w.id
            JOIN users u ON w.user_id = u.id
            WHERE t.type = 'escrow_lock' AND t.status = 'pending'
        """)
        txs = cur.fetchall()
        if not txs:
            print("Aucune transaction 'escrow_lock' en attente.")
        for t in txs:
            print(f"TX ID: {t['id']} | Montant: {t['amount']} | User: {t['owner']} | Order: {t['order_id']}")

        cur.close()
        conn.close()
    except Exception as e:
        print(f"ERROR: {e}")

if __name__ == "__main__":
    check_escrow()
