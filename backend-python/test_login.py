"""Test manuel de connexion — utilise les variables d'environnement."""
import os
import requests
from dotenv import load_dotenv

load_dotenv()

url = os.getenv("TEST_LOGIN_URL", "http://127.0.0.1:8000/auth/login")
email = os.getenv("TEST_LOGIN_EMAIL")
password = os.getenv("TEST_LOGIN_PASSWORD")

if not email or not password:
    print("Définissez TEST_LOGIN_EMAIL et TEST_LOGIN_PASSWORD dans .env")
    raise SystemExit(1)

print(f"POST {url}")
try:
    r = requests.post(url, json={"email": email, "password": password}, timeout=10)
    print(f"Status: {r.status_code}")
    print(f"Response: {r.text[:500]}")
except Exception as e:
    print(f"ERROR: {e}")
