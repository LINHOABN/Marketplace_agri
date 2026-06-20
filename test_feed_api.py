import requests
import json

BASE_URL = "http://localhost:8000/api"

def test_feed():
    print("\n--- Test du Flux (Feed) ---")
    try:
        url = f"{BASE_URL}/feed"
        response = requests.get(url)
        print(f"Status Code: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            items = data.get("items", [])
            print(f"Items trouvés : {len(items)}")
            for i in items:
                if i.get("item_type") == "product":
                    print(f" - [PRODUIT] {i.get('name')} (Prix: {i.get('price')} CFA, Stock: {i.get('quantity_available')})")
                else:
                    print(f" - [POST] {i.get('content')[:30]}...")
        else:
            print(f"Erreur: {response.text}")
    except Exception as e:
        print(f"Erreur de connexion : {e}")

if __name__ == "__main__":
    test_feed()
