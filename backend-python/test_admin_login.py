from sqlalchemy import text
from database import SessionLocal
from utils.security import verify_password

db = SessionLocal()
user = db.execute(text("""
    SELECT u.*, r.role
    FROM users u
    LEFT JOIN user_roles r ON u.id = r.user_id
    WHERE LOWER(u.email) = LOWER(:email)
"""), {"email": "admin@agrimarche.cm"}).mappings().first()

if not user:
    print("[ERREUR] Utilisateur introuvable dans la base de donnees!")
else:
    print(f"[OK] Utilisateur: {user['full_name']}")
    print(f"     Email: {user['email']}")
    print(f"     Role: {user['role']}")
    print(f"     is_active: {user['is_active']}")
    
    pwd_ok = verify_password("Admin@2024!", user["password_hash"])
    print(f"     Mot de passe valide: {pwd_ok}")

db.close()
