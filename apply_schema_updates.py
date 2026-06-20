import psycopg2
import os
from dotenv import load_dotenv

env_path = r'C:\Users\Dr Haoua Madeleine\Desktop\6\backend-python\.env'
load_dotenv(env_path)

def update():
    try:
        conn = psycopg2.connect(os.getenv('DATABASE_URL'))
        cur = conn.cursor()
        
        print("Adding columns to invoices...")
        cur.execute("ALTER TABLE invoices ADD COLUMN IF NOT EXISTS invoice_number VARCHAR(255);")
        cur.execute("ALTER TABLE invoices ADD COLUMN IF NOT EXISTS amount NUMERIC;")
        
        print("Adding negotiation_id to orders...")
        cur.execute("ALTER TABLE orders ADD COLUMN IF NOT EXISTS negotiation_id UUID REFERENCES negotiations(id);")
        
        conn.commit()
        print("SUCCESS: Database schema updated.")
        
        cur.close()
        conn.close()
    except Exception as e:
        print(f"ERROR: {e}")

if __name__ == "__main__":
    update()
