import psycopg2
import os
from dotenv import load_dotenv

env_path = r'C:\Users\Dr Haoua Madeleine\Desktop\6\backend-python\.env'
load_dotenv(env_path)

def extract_detailed():
    try:
        conn = psycopg2.connect(os.getenv('DATABASE_URL'))
        cur = conn.cursor()
        
        # Récupérer les tables, colonnes, types et contraintes
        cur.execute("""
            SELECT 
                t.table_name, 
                c.column_name, 
                c.data_type, 
                c.is_nullable,
                (SELECT pg_get_expr(adbin, adrelid) FROM pg_attrdef WHERE adrelid = pg_class.oid AND adnum = c.ordinal_position) as default_value
            FROM information_schema.tables t
            JOIN information_schema.columns c ON t.table_name = c.table_name
            JOIN pg_class ON pg_class.relname = t.table_name
            WHERE t.table_schema = 'public'
            AND t.table_type = 'BASE TABLE'
            ORDER BY t.table_name, c.ordinal_position;
        """)
        
        current_table = ""
        for row in cur.fetchall():
            table, col, dtype, nullable, default = row
            if table != current_table:
                print(f"\n--- TABLE: {table} ---")
                current_table = table
            print(f"  {col} ({dtype}) - Nullable: {nullable}, Default: {default}")
            
        cur.close()
        conn.close()
    except Exception as e:
        print(f"ERROR: {e}")

if __name__ == "__main__":
    extract_detailed()
