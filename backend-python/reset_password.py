import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv
from utils.security import get_password_hash

load_dotenv()

def reset():
    db_url = os.getenv("DATABASE_URL")
    email = "negoabbaabed923@gmail.com"
    new_password = "admin123"

    print(f"Hachage du nouveau mot de passe...")
    hashed = get_password_hash(new_password)

    print(f"Mise à jour dans la base de données...")
    engine = create_engine(db_url)
    with engine.connect() as conn:
        conn.execute(
            text("UPDATE users SET password_hash = :p WHERE email = :e"), 
            {"p": hashed, "e": email}
        )
        conn.commit()
    
    print(f"SUCCÈS : Le mot de passe de {email} est maintenant : {new_password}")

if __name__ == "__main__":
    reset()
