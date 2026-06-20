import psycopg2
import os
from dotenv import load_dotenv

load_dotenv('backend-python/.env')

def check_db():
    conn = psycopg2.connect(os.getenv('DATABASE_URL'))
    cur = conn.cursor()
    
    print("--- VÉRIFICATION DES CONTRAINTES DE LA BASE ---")
    
    # 1. Clés Étrangères (Relations)
    cur.execute("""
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
    """)
    print("\n🔗 RELATIONS (Clés Étrangères) :")
    for row in cur.fetchall():
        print(f"  {row[0]}.{row[1]} -> {row[2]}")
        
    # 2. Contraintes d'Unicité (Pour les relations 1:1)
    cur.execute("""
        SELECT 
            table_name, 
            column_name
        FROM 
            information_schema.key_column_usage
        WHERE 
            constraint_name IN (
                SELECT constraint_name 
                FROM information_schema.table_constraints 
                WHERE constraint_type = 'UNIQUE'
            )
        ORDER BY table_name;
    """)
    print("\n💎 UNICITÉ (Contraintes UNIQUE) :")
    for row in cur.fetchall():
        print(f"  {row[0]}.{row[1]} est UNIQUE")
        
    cur.close()
    conn.close()

if __name__ == "__main__":
    check_db()
