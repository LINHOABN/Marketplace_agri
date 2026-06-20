import psycopg2
import os
from dotenv import load_dotenv

env_path = r'C:\Users\Dr Haoua Madeleine\Desktop\6\backend-python\.env'
load_dotenv(env_path)

def check_db():
    try:
        db_url = os.getenv('DATABASE_URL')
        conn = psycopg2.connect(db_url)
        cur = conn.cursor()
        
        print("DATABASE CONSTRAINTS VERIFICATION")
        
        # 1. Foreign Keys
        cur.execute("""
            SELECT tc.table_name, kcu.column_name, ccu.table_name AS foreign_table
            FROM information_schema.table_constraints AS tc 
            JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name
            JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name
            WHERE tc.constraint_type = 'FOREIGN KEY';
        """)
        print("\nRELATIONS (FK):")
        for row in cur.fetchall():
            print(f"  {row[0]}.{row[1]} -> {row[2]}")
            
        # 2. Unique constraints (for 1:1)
        cur.execute("""
            SELECT tc.table_name, kcu.column_name
            FROM information_schema.table_constraints AS tc 
            JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name
            WHERE tc.constraint_type = 'UNIQUE';
        """)
        print("\nUNICITE (UNIQUE):")
        for row in cur.fetchall():
            print(f"  {row[0]}.{row[1]} is UNIQUE")
            
        cur.close()
        conn.close()
    except Exception as e:
        print(f"ERROR: {e}")

if __name__ == "__main__":
    check_db()
