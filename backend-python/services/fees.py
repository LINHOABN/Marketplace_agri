# Commission plateforme et Frais de livraison AgriMarché

def calculate_split(total_amount: float, delivery_fee: float = 2000.0, commission_rate: float = 0.01):
    """
    Calcule la répartition dynamique entre Admin, Livreur et Vendeur.
    Par défaut : Admin (1%), Livreur (Frais fixes), Vendeur (Reste).
    """
    # Le sous-total payé par l'acheteur est généralement Produit + Livraison. 
    # La commission est prise sur la part produit.
    product_price = total_amount - delivery_fee
    
    admin_commission = product_price * commission_rate
    seller_share = product_price - admin_commission
    
    return {
        "deliverer": delivery_fee,
        "platform": admin_commission,
        "seller": seller_share,
        "total": total_amount
    }
