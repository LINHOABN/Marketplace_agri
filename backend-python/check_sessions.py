"""Vérifie que la table user_sessions existe et est accessible."""
import sys
sys.path.insert(0, ".")

from sqlalchemy import text
from database import engine

def check():
    with engine.connect() as conn:
        # Vérifier que la table user_sessions existe
        r = conn.execute(text("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'user_sessions'
            ) as exists
        """)).mappings().first()
        print("Table user_sessions existe:", r["exists"])
        
        if r["exists"]:
            # Compter les enregistrements
            count = conn.execute(text("SELECT COUNT(*) as c FROM user_sessions")).mappings().first()
            print("Nombre de sessions:", count["c"])
            
            # Vérifier les colonnes
            cols = conn.execute(text("""
                SELECT column_name FROM information_schema.columns 
                WHERE table_name = 'user_sessions'
            """)).fetchall()
            print("Colonnes:", [c[0] for c in cols])
        else:
            print("❌ La table user_sessions n'existe pas ! Lancez la migration.")

if __name__ == "__main__":
    check()
