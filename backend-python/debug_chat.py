import asyncio
from sqlalchemy import text
from database import SessionLocal

async def debug_chat_messages(conv_id, user_id):
    db = SessionLocal()
    try:
        query = text("""
            SELECT 
                c.id,
                p.id as product_id,
                p.name as product_name,
                p.image_url as product_image,
                p.price as product_price,
                p.unit as product_unit,
                s.seller_id as product_seller_id,
                u_other.id as interlocutor_id,
                u_other.full_name as interlocutor_name,
                u_other.avatar_url as interlocutor_avatar,
                (SELECT role FROM user_roles WHERE user_id = u_other.id LIMIT 1) as interlocutor_role
            FROM conversations c
            JOIN products p ON c.product_id = p.id
            JOIN shops s ON p.shop_id = s.id
            JOIN users u_other ON (c.user1_id = u_other.id OR c.user2_id = u_other.id) AND u_other.id != CAST(:u_id AS uuid)
            WHERE c.id = CAST(:c_id AS uuid)
        """)
        
        res = db.execute(query, {"c_id": conv_id, "u_id": user_id}).mappings().first()
        if res:
            print("CONVERSATION HEADER FOUND:")
            for k, v in res.items():
                print(f"  {k}: {v}")
        else:
            print("CONVERSATION HEADER NOT FOUND!")
            conv = db.execute(text("SELECT * FROM conversations WHERE id = CAST(:id AS uuid)"), {"id": conv_id}).mappings().first()
            if conv:
                print(f"Conversation exists but JOIN failed. P: {conv['product_id']}")
                p = db.execute(text("SELECT shop_id FROM products WHERE id = CAST(:id AS uuid)"), {"id": str(conv['product_id'])}).mappings().first()
                if p:
                    print(f"Product exists, shop_id: {p['shop_id']}")
                    s = db.execute(text("SELECT id FROM shops WHERE id = CAST(:id AS uuid)"), {"id": str(p['shop_id'])}).scalar()
                    print(f"Shop exists: {s is not None}")
                else:
                    print("Product does not exist.")
            else:
                print("Conversation not found.")
                
    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(debug_chat_messages("58437765-9ec3-4420-8eef-cbfdb9e730d4", "7015f6be-880b-467c-9a5b-5de597526dfd"))
