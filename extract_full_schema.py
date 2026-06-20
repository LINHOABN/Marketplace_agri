import psycopg2
import os
from dotenv import load_dotenv

env_path = r'C:\Users\Dr Haoua Madeleine\Desktop\6\backend-python\.env'
load_dotenv(env_path)

def extract():
    try:
        conn = psycopg2.connect(os.getenv('DATABASE_URL'))
        cur = conn.cursor()
        
        # Récupérer les tables et colonnes
        cur.execute("""
            SELECT table_name, column_name, data_type
            FROM information_schema.columns
            WHERE table_schema = 'public'
            ORDER BY table_name, ordinal_position;
        """)
        
        current_table = ""
        for row in cur.fetchall():
            table, col, dtype = row
            if table != current_table:
                print(f"\n--- TABLE: {table} ---")
                current_table = table
            print(f"  {col} ({dtype})")
            
        cur.close()
        conn.close()
    except Exception as e:
        print(f"ERROR: {e}")

if __name__ == "__main__":
    extract()
