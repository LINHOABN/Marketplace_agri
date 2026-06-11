from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import text
from database import get_db
from dependencies import get_current_user
from pydantic import BaseModel
from typing import Optional

router = APIRouter(prefix="/admin", tags=["admin"])


class RoleDecision(BaseModel):
    approve: bool
    note: Optional[str] = None

class SettingsUpdate(BaseModel):
    key: str
    value: str

from dependencies import is_admin

@router.get("/stats")
async def get_admin_stats(admin: dict = Depends(is_admin), db: Session = Depends(get_db)):
    try:
        # Récupérer le taux de commission dynamique (défaut 0.05)
        comm_res = db.execute(text('SELECT "value" FROM platform_settings WHERE "key" = \'commission_rate\'')).scalar()
        comm_rate = float(comm_res) if comm_res else 0.05

        query = text(f"""
            SELECT 
                (SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE status IN ('delivered', 'completed') AND created_at >= date_trunc('month', now())) as revenue_month,
                (SELECT COALESCE(SUM(total_amount) * {comm_rate}, 0) FROM orders WHERE status IN ('delivered', 'completed')) as commissions_total,
                (SELECT COUNT(*) FROM orders WHERE created_at >= CURRENT_DATE) as transactions_today,
                (SELECT COUNT(DISTINCT id) FROM users WHERE created_at >= now() - interval '7 days') as active_users_7d,
                (SELECT COUNT(*) FROM disputes WHERE status = 'open') as open_disputes,
                (SELECT COUNT(*) FROM users WHERE created_at >= date_trunc('week', now())) as new_users_week,
                (SELECT COUNT(*) FROM role_requests WHERE status = 'pending') as pending_role_requests
        """)
        result = db.execute(query).mappings().first()
        return dict(result) if result else {}
    except Exception as e:
        print(f"CRITICAL: Admin Stats Error: {e}")
        raise HTTPException(status_code=500, detail="Erreur lors de la récupération des statistiques")

@router.get("/stats/charts")
async def get_chart_stats(admin: dict = Depends(is_admin), db: Session = Depends(get_db)):
    try:
        # Transactions par jour
        tx_query = text("""
            SELECT DATE(created_at) as date, COUNT(*) as count 
            FROM orders 
            WHERE created_at >= now() - interval '30 days'
            GROUP BY DATE(created_at)
            ORDER BY DATE(created_at) ASC
        """)
        
        # Répartition rôles (via la table user_roles)
        dist_query = text("""
            SELECT role::text as role, COUNT(*) as value 
            FROM user_roles 
            GROUP BY role
        """)
        
        # Top catégories (basé sur le nombre de produits)
        cat_query = text("""
            SELECT c.name as category, COUNT(p.id) as count
            FROM categories c
            JOIN products p ON c.id = p.category_id
            GROUP BY c.name
            ORDER BY count DESC
            LIMIT 5
        """)
        
        tx_res = db.execute(tx_query).mappings().all()
        dist_res = db.execute(dist_query).mappings().all()
        cat_res = db.execute(cat_query).mappings().all()
        
        return {
            "transactions": [dict(r) for r in tx_res],
            "distribution": [dict(r) for r in dist_res],
            "categories": [dict(r) for r in cat_res]
        }
    except Exception as e:
        print(f"CRITICAL: Admin Chart Stats Error: {e}")
        raise HTTPException(status_code=500, detail="Erreur lors de la génération des graphiques")

@router.get("/disputes")
async def get_admin_disputes(admin: dict = Depends(is_admin), db: Session = Depends(get_db)):
    try:
        query = text("""
            SELECT d.id, d.reason, d.status, d.created_at,
                   u.full_name as buyer_name,
                   o.id as order_id, o.total_amount as total_price
            FROM disputes d
            JOIN users u ON d.initiator_id = u.id
            JOIN orders o ON d.order_id = o.id
            WHERE d.status = 'open'
            ORDER BY d.created_at ASC
        """)
        result = db.execute(query).mappings().all()
        return [dict(r) for r in result]
    except Exception as e:
        print(f"CRITICAL: Admin Disputes Error: {e}")
        raise HTTPException(status_code=500, detail="Impossible de récupérer les litiges")


@router.get("/role-requests")
async def list_role_requests(
    status: str = "pending",
    admin: dict = Depends(is_admin),
    db: Session = Depends(get_db)
):
    try:
        result = db.execute(
            text("""
                SELECT rr.id, rr.user_id, rr.requested_role, rr.status, rr.created_at, rr.updated_at,
                       u.full_name as user_name, u.email, u.phone, u.id_card_url, u.selfie_url
                FROM role_requests rr
                JOIN users u ON rr.user_id = u.id
                WHERE rr.status = :status
                ORDER BY rr.updated_at DESC, rr.created_at ASC
            """),
            {"status": status}
        ).mappings().all()
        rows = []
        for r in result:
            row = dict(r)
            row["id"] = str(row["id"])
            row["user_id"] = str(row["user_id"])
            rows.append(row)
        return rows
    except Exception as e:
        print(f"ERROR: Role requests fetch error: {e}")
        return []


@router.post("/role-requests/{request_id}/decide")
async def decide_role_request(
    request_id: str,
    body: RoleDecision,
    admin: dict = Depends(is_admin),
    db: Session = Depends(get_db),
):
    try:
        req = db.execute(
            text("SELECT * FROM role_requests WHERE id = :id AND status = 'pending'"),
            {"id": request_id},
        ).mappings().first()
        
        if not req:
            raise HTTPException(status_code=404, detail="Demande introuvable ou déjà traitée")

        new_status = "approved" if body.approve else "rejected"
        db.execute(
            text("UPDATE role_requests SET status = :st, updated_at = NOW() WHERE id = :id"),
            {"st": new_status, "id": request_id},
        )

        if body.approve:
            role = req["requested_role"]
            # ATTENTION : On n'écrase plus les anciens rôles. Un utilisateur peut être Vendeur ET Livreur.
            # On insère le nouveau rôle. S'il existe déjà, on ne fait rien.
            db.execute(
                text("""
                    INSERT INTO user_roles (user_id, role, created_at) 
                    VALUES (CAST(:u_id AS uuid), CAST(:role AS user_role), NOW())
                    ON CONFLICT (user_id, role) DO NOTHING
                """),
                {"role": role, "u_id": req["user_id"]},
            )
            
            # Action Cruciale : Rendre l'utilisateur CREDIBLE (Vérifié) aux yeux de tous
            db.execute(
                text("UPDATE users SET is_verified = TRUE WHERE id = CAST(:u_id AS uuid)"),
                {"u_id": req["user_id"]}
            )
            
            # Si c'est un vendeur, on s'assure qu'il a une boutique par défaut
            if role == "seller":
                existing_shop = db.execute(
                    text("SELECT id FROM shops WHERE seller_id = CAST(:u_id AS uuid)"),
                    {"u_id": req["user_id"]},
                ).mappings().first()
                
                if not existing_shop:
                    db.execute(
                        text("""
                            INSERT INTO shops (seller_id, name, description, created_at)
                            VALUES (CAST(:u_id AS uuid), 'Ma Boutique', 'Boutique AgriMarché', NOW())
                        """),
                        {"u_id": req["user_id"]},
                    )

        db.commit()
        return {"success": True, "status": new_status}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"CRITICAL: Role Decision Error: {e}")
        raise HTTPException(status_code=500, detail=f"Erreur lors du traitement : {str(e)}")


# ─── Admin Users List ──────────────────────────────────────────────────────────
@router.get("/users")
async def list_users(
    page: int = 1,
    limit: int = 20,
    search: str = "",
    role: str = "",
    admin: dict = Depends(is_admin),
    db: Session = Depends(get_db),
):
    offset = (page - 1) * limit
    conditions = ["1=1"]
    params: dict = {"limit": limit, "offset": offset}
    if search:
        conditions.append("(u.full_name ILIKE :search OR u.email ILIKE :search)")
        params["search"] = f"%{search}%"
    if role:
        conditions.append("r.role::text = :role")
        params["role"] = role
    where = " AND ".join(conditions)
    q = text(f"""
        SELECT u.id, u.full_name as name, u.email, u.phone,
               u.location as city, u.created_at,
               u.is_verified, u.id_card_url, u.selfie_url,
               r.role,
               (SELECT COUNT(*) FROM orders o WHERE o.buyer_id = u.id) as orders_count
        FROM users u
        LEFT JOIN user_roles r ON u.id = r.user_id
        WHERE {where}
        ORDER BY u.created_at DESC
        LIMIT :limit OFFSET :offset
    """)
    count_q = text(f"""
        SELECT COUNT(*) FROM users u LEFT JOIN user_roles r ON u.id = r.user_id WHERE {where}
    """)
    rows = db.execute(q, params).mappings().all()
    total = db.execute(count_q, {k: v for k, v in params.items() if k not in ("limit", "offset")}).scalar()
    return {
        "users": [dict(r) for r in rows],
        "total": total,
        "totalPages": max(1, -(-total // limit)),
    }


@router.get("/users/{user_id}")
async def get_user_detail(user_id: str, admin: dict = Depends(is_admin), db: Session = Depends(get_db)):
    """Détails complets d'un utilisateur pour l'admin."""
    try:
        query = text("""
            SELECT u.*, r.role,
                   (SELECT COUNT(*) FROM orders o WHERE o.buyer_id = u.id) as orders_as_buyer,
                   (SELECT COUNT(*) FROM products p JOIN shops s ON p.shop_id = s.id WHERE s.seller_id = u.id) as products_count
            FROM users u
            LEFT JOIN user_roles r ON u.id = r.user_id
            WHERE u.id = CAST(:u_id AS uuid)
        """)
        row = db.execute(query, {"u_id": user_id}).mappings().first()
        if not row:
            raise HTTPException(status_code=404, detail="Utilisateur introuvable")
        
        user_data = dict(row)
        user_data["id"] = str(user_data["id"])
        # Supprimer le hash pour la sécurité
        if "password_hash" in user_data:
            del user_data["password_hash"]
            
        return user_data
    except Exception as e:
        print(f"Error fetching user detail: {e}")
        raise HTTPException(status_code=500, detail="Erreur lors de la récupération des détails")


# ─── Admin Transactions List ───────────────────────────────────────────────────
@router.get("/transactions")
async def list_transactions(
    page: int = 1,
    limit: int = 20,
    search: str = "",
    status: str = "",
    from_date: str = "",
    to_date: str = "",
    minAmount: float = None,
    maxAmount: float = None,
    admin: dict = Depends(is_admin),
    db: Session = Depends(get_db),
):
    offset = (page - 1) * limit
    conditions = ["1=1"]
    params: dict = {"limit": limit, "offset": offset}

    if search:
        conditions.append("""(
            t.id::text ILIKE :search
            OR t.reference ILIKE :search
            OR buyer.full_name ILIKE :search
            OR seller.full_name ILIKE :search
        )""")
        params["search"] = f"%{search}%"
    if status:
        conditions.append("t.status::text = :status")
        params["status"] = status
    if from_date:
        conditions.append("t.created_at >= :from_date")
        params["from_date"] = from_date
    if to_date:
        conditions.append("t.created_at <= :to_date::date + interval '1 day'")
        params["to_date"] = to_date
    if minAmount is not None:
        conditions.append("ABS(t.amount) >= :min_amount")
        params["min_amount"] = minAmount
    if maxAmount is not None:
        conditions.append("ABS(t.amount) <= :max_amount")
        params["max_amount"] = maxAmount

    where = " AND ".join(conditions)

    q = text(f"""
        SELECT t.id, t.type, t.amount, t.status, t.description, t.reference,
               t.created_at,
               buyer.full_name as buyer_name,
               seller.full_name as seller_name,
               (ABS(t.amount) * 0.05) as commission
        FROM transactions t
        JOIN wallets w ON t.wallet_id = w.id
        LEFT JOIN users buyer ON w.user_id = buyer.id
        LEFT JOIN orders ord ON t.reference ILIKE '%' || ord.id::text || '%'
        LEFT JOIN shops sh ON ord.shop_id = sh.id
        LEFT JOIN users seller ON sh.seller_id = seller.id
        WHERE {where}
        ORDER BY t.created_at DESC
        LIMIT :limit OFFSET :offset
    """)
    count_q = text(f"""
        SELECT COUNT(*) FROM transactions t
        JOIN wallets w ON t.wallet_id = w.id
        LEFT JOIN users buyer ON w.user_id = buyer.id
        LEFT JOIN orders ord ON t.reference ILIKE '%' || ord.id::text || '%'
        LEFT JOIN shops sh ON ord.shop_id = sh.id
        LEFT JOIN users seller ON sh.seller_id = seller.id
        WHERE {where}
    """)
    try:
        rows = db.execute(q, params).mappings().all()
        total_count_params = {k: v for k, v in params.items() if k not in ("limit", "offset")}
        total = db.execute(count_q, total_count_params).scalar() or 0
        return {
            "transactions": [dict(r) for r in rows],
            "total": total,
            "totalPages": max(1, -(-total // limit)),
        }
    except Exception as e:
        print(f"[ADMIN_TX] Error: {e}")
        raise HTTPException(status_code=500, detail=f"Erreur transactions: {str(e)}")


# ─── Admin Transactions CSV Export ────────────────────────────────────────────
import csv
import io as csv_io
from fastapi.responses import StreamingResponse

@router.get("/transactions/export-csv")
async def export_transactions_csv(
    search: str = "",
    status: str = "",
    from_date: str = "",
    to_date: str = "",
    admin: dict = Depends(is_admin),
    db: Session = Depends(get_db),
):
    conditions = ["1=1"]
    params: dict = {}
    if search:
        conditions.append("(t.id::text ILIKE :search OR t.reference ILIKE :search)")
        params["search"] = f"%{search}%"
    if status:
        conditions.append("t.status::text = :status")
        params["status"] = status
    if from_date:
        conditions.append("t.created_at >= :from_date")
        params["from_date"] = from_date
    if to_date:
        conditions.append("t.created_at <= :to_date::date + interval '1 day'")
        params["to_date"] = to_date

    where = " AND ".join(conditions)
    q = text(f"""
        SELECT t.id, t.type, t.amount, t.status, t.description, t.reference, t.created_at,
               buyer.full_name as buyer_name
        FROM transactions t
        JOIN wallets w ON t.wallet_id = w.id
        LEFT JOIN users buyer ON w.user_id = buyer.id
        WHERE {where}
        ORDER BY t.created_at DESC
        LIMIT 5000
    """)
    rows = db.execute(q, params).mappings().all()

    output = csv_io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["ID", "Type", "Montant", "Statut", "Description", "Référence", "Date", "Utilisateur"])
    for r in rows:
        writer.writerow([
            str(r["id"])[:8], r["type"], r["amount"], r["status"],
            r["description"] or "", r["reference"] or "",
            str(r["created_at"])[:19], r["buyer_name"] or ""
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=transactions.csv"}
    )

# ─── Admin Platform Settings ──────────────────────────────────────────────────
@router.get("/settings")
async def get_admin_settings(admin: dict = Depends(is_admin), db: Session = Depends(get_db)):
    """Récupère les réglages de la plateforme."""
    try:
        rows = db.execute(text('SELECT "key", "value" FROM platform_settings')).mappings().all()
        return [dict(r) for r in rows]
    except Exception as e:
        print(f"[ADMIN_SETTINGS] Error: {e}")
        raise HTTPException(status_code=500, detail="Impossible de récupérer les réglages")

@router.post("/settings")
async def update_admin_setting(req: SettingsUpdate, admin: dict = Depends(is_admin), db: Session = Depends(get_db)):
    """Met à jour un réglage de la plateforme."""
    try:
        db.execute(
            text("""
                INSERT INTO platform_settings ("key", "value", updated_at)
                VALUES (:key, :value, NOW())
                ON CONFLICT ("key") DO UPDATE SET "value" = :value, updated_at = NOW()
            """),
            {"key": req.key, "value": req.value}
        )
        db.commit()
        return {"success": True, "message": f"Réglage {req.key} mis à jour"}
    except Exception as e:
        db.rollback()
        print(f"[ADMIN_SETTINGS] Update Error: {e}")
        raise HTTPException(status_code=500, detail="Erreur lors de la mise à jour")
