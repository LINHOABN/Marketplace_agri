import psycopg2
import os
from dotenv import load_dotenv

load_dotenv('backend-python/.env')

def check_db():
    try:
        conn = psycopg2.connect(os.getenv('DATABASE_URL'))
        cur = conn.cursor()
        
        print("--- DATABASE CONSTRAINTS VERIFICATION ---")
        
        # 1. Foreign Keys
        cur.execute(\"\"\"
            SELECT 
                tc.table_name, 
                kcu.column_name, 
                ccu.table_name AS foreign_table_name
            FROM 
                information_schema.table_constraints AS tc 
                JOIN information_schema.key_column_usage AS kcu
                  ON tc.constraint_name = kcu.constraint_name
                JOIN information_schema.constraint_column_usage AS ccu
                  ON ccu.constraint_name = tc.constraint_name
            WHERE constraint_type = 'FOREIGN KEY'
            ORDER BY tc.table_name;
        \"\"\")
        print(\"\\n--- FOREIGN KEYS ---\")
        for row in cur.fetchall():
            print(f\"  {row[0]}.{row[1]} -> {row[2]}\")
            
        # 2. Unique Constraints (For 1:1)
        cur.execute(\"\"\"
            SELECT 
                tc.table_name, 
                kcu.column_name
            FROM 
                information_schema.table_constraints AS tc 
                JOIN information_schema.key_column_usage AS kcu
                  ON tc.constraint_name = kcu.constraint_name
            WHERE tc.constraint_type = 'UNIQUE'
            ORDER BY tc.table_name;
        \"\"\")
        print(\"\\n--- UNIQUE CONSTRAINTS ---\")
        for row in cur.fetchall():
            print(f\"  {row[0]}.{row[1]} is UNIQUE\")
            
        cur.close()
        conn.close()
    except Exception as e:
        print(f\"ERROR: {e}\")

if __name__ == \"__main__\":
    check_db()
