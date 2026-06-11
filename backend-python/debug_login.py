"""Test login endpoint directly to isolate server error."""
import sys
sys.path.insert(0, ".")

from sqlalchemy import text
from database import engine

def test_login(email, password):
    from utils.security import verify_password
    from services.sessions import create_user_session
    
    with engine.connect() as db:
        query = text("""
            SELECT u.*, r.role
            FROM users u
            LEFT JOIN user_roles r ON u.id = r.user_id
            WHERE LOWER(u.email) = LOWER(:login_id)
        """)
        user = db.execute(query, {"login_id": email}).mappings().first()
        
        if not user:
            print("❌ Utilisateur introuvable pour:", email)
            return
        
        print("✅ Utilisateur trouvé:", user["full_name"], "| Rôle:", user.get("role"))
        
        if not verify_password(password, user["password_hash"]):
            print("❌ Mot de passe incorrect")
            return
        
        print("✅ Mot de passe correct")
        
        # Test session creation
        try:
            tokens = create_user_session(
                db, str(user["id"]), str(user["email"]),
                str(user.get("role") or "buyer")
            )
            db.commit()
            print("✅ Session créée:", tokens["session_id"])
        except Exception as e:
            print("❌ Erreur création session:", e)

if __name__ == "__main__":
    email = input("Email: ") if len(sys.argv) < 2 else sys.argv[1]
    password = input("Mot de passe: ") if len(sys.argv) < 3 else sys.argv[2]
    test_login(email, password)
