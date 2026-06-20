import requests
import json
import uuid
import os

# --- CONFIGURATION ---
BASE_URL = "http://localhost:8000/api"

def print_section(title):
    print("\n" + "="*60)
    print(f" {title.upper()} ".center(60, "="))
    print("="*60)

def test_agrimarche():
    # 1. AUTHENTIFICATION
    print_section("Authentification")
    
    unique_suffix = uuid.uuid4().hex[:6]
    test_user = {
        "full_name": f"User Test {unique_suffix}",
        "email": f"test_{unique_suffix}@agri.com",
        "password": "password123",
        "phone": f"+2376{uuid.uuid4().hex[:8]}"[:13]
    }

    print(f"[*] Inscription de {test_user['email']}...")
    reg_resp = requests.post(f"{BASE_URL}/auth/register", json=test_user)
    if reg_resp.status_code != 200:
        print(f"[!] Echec Inscription: {reg_resp.text}")
        return

    print(f"[*] Connexion...")
    login_resp = requests.post(f"{BASE_URL}/auth/login", json={
        "email": test_user["email"],
        "password": test_user["password"]
    })
    
    if login_resp.status_code != 200:
        print(f"[!] Echec Connexion: {login_resp.text}")
        return

    tokens = login_resp.json()
    access_token = tokens["access_token"]
    user_id = tokens["user"]["id"]
    headers = {"Authorization": f"Bearer {access_token}"}
    print(f"[OK] Connecté avec le Token: {access_token[:20]}...")

    # 2. MARKETPLACE
    print_section("Marketplace")
    print("[*] Récupération de la liste des produits...")
    prod_resp = requests.get(f"{BASE_URL}/products")
    if prod_resp.status_code == 200:
        products = prod_resp.json()
        print(f"[OK] {len(products)} produits trouvés.")
        if products:
            first_prod = products[0]
            print(f"     Premier produit: {first_prod['name']} ({first_prod['price']} FCFA)")
    else:
        print(f"[!] Erreur products: {prod_resp.status_code}")

    # 3. FACTURES (Verification du Fix)
    print_section("Facturation (Vérification du Fix)")
    
    # On cherche une commande existante pour tester le téléchargement
    print("[*] Recherche d'une commande pour tester la facture...")
    order_resp = requests.get(f"{BASE_URL}/orders", headers=headers)
    
    # Si pas de commande, on essaie de recuperer une commande globale (simulée)
    if order_resp.status_code == 200:
        orders = order_resp.json()
        if not orders:
            print("[#] Aucune commande pour cet utilisateur. Créons-en une (si possible)...")
            # Ici on s'arrête car créer une commande complète nécessite bcp de data
            print("[#] Veuillez effectuer un achat réel sur l'UI pour tester le téléchargement.")
        else:
            order_id = orders[0]["id"]
            print(f"[*] Téléchargement de la facture pour la commande {order_id}...")
            # Test du fix : l'endpoint de téléchargement avec le token en paramètre URL
            invoice_url = f"{BASE_URL}/invoices/{order_id}/download?token={access_token}"
            print(f"[*] URL: {invoice_url}")
            
            inv_resp = requests.get(invoice_url)
            if inv_resp.status_code == 200:
                filename = f"facture_{order_id[:8]}.pdf"
                with open(filename, "wb") as f:
                    f.write(inv_resp.content)
                print(f"[OK] Facture téléchargée avec succès: {os.path.abspath(filename)}")
            else:
                print(f"[!] Echec Téléchargement: {inv_resp.status_code} - {inv_resp.text}")
    else:
         print(f"[!] Erreur orders: {order_resp.status_code}")

    print_section("FIN DES TESTS")

if __name__ == "__main__":
    try:
        test_agrimarche()
    except Exception as e:
        print(f"\n[CRITIQUE] Une erreur est survenue: {e}")
        print("Assurez-vous que le serveur backend est lancé sur http://localhost:8000")
