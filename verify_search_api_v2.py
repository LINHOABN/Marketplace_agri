import requests
import json

BASE_URL = "http://localhost:8000/api" # URL avec /api

def test_search(query):
    print(f"\n--- Test de recherche pour : '{query}' ---")
    try:
        url = f"{BASE_URL}/search/?q={query}"
        response = requests.get(url)
        print(f"Status Code: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            products = data.get("products", [])
            print(f"Produits trouvés : {len(products)}")
            for p in products:
                print(f" - {p.get('name')} ({p.get('id')})")
        else:
            print(f"Erreur: {response.text}")
    except Exception as e:
        print(f"Erreur de connexion : {e}")

if __name__ == "__main__":
    test_search("Tomate")
    test_search("Bio")
    test_search("")
