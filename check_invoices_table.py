import psycopg2
import os
from dotenv import load_dotenv

env_path = r'C:\Users\Dr Haoua Madeleine\Desktop\6\backend-python\.env'
load_dotenv(env_path)

def check():
    try:
        conn = psycopg2.connect(os.getenv('DATABASE_URL'))
        cur = conn.cursor()
        
        cur.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'invoices'
            );
        """)
        exists = cur.fetchone()[0]
        print(f"Invoices table exists: {exists}")
        
        if exists:
            cur.execute("SELECT COUNT(*) FROM invoices;")
            count = cur.fetchone()[0]
            print(f"Number of rows in invoices: {count}")
            
            cur.execute("""
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_name = 'invoices';
            """)
            for row in cur.fetchall():
                print(f"  Column: {row[0]} ({row[1]})")
                
        cur.close()
        conn.close()
    except Exception as e:
        print(f"ERROR: {e}")

if __name__ == "__main__":
    check()
