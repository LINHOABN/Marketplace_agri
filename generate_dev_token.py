import os
from jose import jwt
from datetime import datetime, timedelta
from dotenv import load_dotenv

# Charger le même SECRET_KEY que le backend
load_dotenv('backend-python/.env')
SECRET_KEY = os.getenv("JWT_SECRET", "supersecretkey123")
ALGORITHM = os.getenv("ALGORITHM", "HS256")

def generate_dev_token(user_id="a18cdfdd-e676-4157-bdeb-681b37645473"):
    """Génère un token valide 1 an pour le test en local."""
    expire = datetime.utcnow() + timedelta(days=365)
    to_encode = {
        "id": user_id,
        "exp": expire,
        "sub": "dev_test_user"
    }
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    print(f"\n--- TOKEN DE TEST (VALIDE 1 AN) ---")
    print(encoded_jwt)
    print(f"------------------------------------\n")
    print(f"Lien de téléchargement direct (exemple) :")
    print(f"http://localhost:8000/api/invoices/{user_id}/download?token={encoded_jwt}")

if __name__ == "__main__":
    generate_dev_token()
