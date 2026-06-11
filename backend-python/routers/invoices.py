from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import text
from database import get_db
import os
from dependencies import get_current_user

router = APIRouter(prefix="/invoices", tags=["invoices"])

from utils.invoice_generator import generate_invoice_pdf

@router.get("/{order_id}/download")
async def download_invoice(order_id: str, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        # 1. Chercher si la facture existe déjà
        query = text("SELECT file_path FROM invoices WHERE order_id = CAST(:id AS uuid)")
        result = db.execute(query, {"id": order_id}).mappings().first()
        
        file_path = result["file_path"] if result else None
        
        # 2. Si non, on la génère à la volée
        if not file_path or not os.path.exists(file_path):
            # Récupérer les données de la commande
            order_query = text("""
                SELECT o.*, p.name as product_name, p.price, s.name as shop_name, u.full_name as buyer_name
                FROM orders o
                JOIN products p ON o.product_id = p.id
                JOIN shops s ON o.shop_id = s.id
                JOIN users u ON o.buyer_id = u.id
                WHERE o.id = CAST(:id AS uuid)
            """)
            order_data = db.execute(order_query, {"id": order_id}).mappings().first()
            if not order_data:
                raise HTTPException(status_code=404, detail="Commande introuvable")
            
            # Calculs
            subtotal = float(order_data["price"]) * float(order_data["quantity"])
            commission = subtotal * 0.03
            # On simule le delivery fee s'il n'est pas en BDD (normalement il devrait y être)
            delivery_fee = 2000 if order_data["delivery_address"] != "Retrait vendeur" else 0
            
            data = dict(order_data)
            data["subtotal"] = subtotal
            data["commission"] = commission
            data["delivery_fee"] = delivery_fee
            
            file_name = f"invoice_{order_id[:8]}.pdf"
            file_path = os.path.join("uploads", "invoices", file_name)
            
            # Générer le PDF
            generate_invoice_pdf(data, file_path)
            
            # Enregistrer en BDD si nouvelle
            if not result:
                db.execute(text("""
                    INSERT INTO invoices (id, order_id, file_path, status, created_at)
                    VALUES (gen_random_uuid(), CAST(:order_id AS uuid), :path, 'paid', NOW())
                """), {"order_id": order_id, "path": file_path})
                db.commit()
            else:
                db.execute(text("UPDATE invoices SET file_path = :path WHERE order_id = CAST(:id AS uuid)"), {"path": file_path, "id": order_id})
                db.commit()

        return FileResponse(path=file_path, filename=f"Facture-AgriMarche-{order_id[:8]}.pdf", media_type="application/pdf")
    except Exception as e:
        db.rollback()
        print(f"INVOICE ERROR: {e}")
        if isinstance(e, HTTPException): raise e
        raise HTTPException(status_code=500, detail=f"Erreur téléchargement: {str(e)}")

@router.get("/{order_id}/verify")
async def verify_invoice(order_id: str, db: Session = Depends(get_db)):
    try:
        query = text("SELECT * FROM orders WHERE id = :id")
        result = db.execute(query, {"id": order_id}).mappings().first()
        if not result:
            raise HTTPException(status_code=404, detail="Facture invalide")
        
        return {"authentic": True, "order": result}
    except Exception:
        raise HTTPException(status_code=500, detail="Erreur vérification")
