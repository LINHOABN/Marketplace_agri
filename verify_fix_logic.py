import psycopg2
import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# Move to backend-python to load .env correctly
env_path = r'C:\Users\Dr Haoua Madeleine\Desktop\6\backend-python\.env'
load_dotenv(env_path)

DATABASE_URL = os.getenv("DATABASE_URL")
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)

def verify():
    db = SessionLocal()
    try:
        # 1. Get a sample order
        order_query = text("SELECT id FROM orders LIMIT 1")
        order = db.execute(order_query).mappings().first()
        if not order:
            print("No orders found.")
            return
        
        order_id = str(order['id'])
        print(f"Testing with Order ID: {order_id}")
        
        # 2. Check if SELECT query works now
        select_query = text("SELECT pdf_url FROM invoices WHERE order_id = CAST(:id AS uuid)")
        result = db.execute(select_query, {"id": order_id}).mappings().first()
        print(f"Select result: {result}")
        
        # 3. Simulate information retrieval for PDF
        order_data_query = text("""
            SELECT o.*, p.name as product_name, p.price, s.name as shop_name, u.full_name as buyer_name
            FROM orders o
            JOIN products p ON o.product_id = p.id
            JOIN shops s ON o.shop_id = s.id
            JOIN users u ON o.buyer_id = u.id
            WHERE o.id = CAST(:id AS uuid)
        """)
        order_data = db.execute(order_data_query, {"id": order_id}).mappings().first()
        if order_data:
            print(f"Order data retrieved successfully: {order_data['product_name']}")
            
            # 4. Check if INSERT works (using a temporary order_id or rollback)
            # We'll do a rollback to be safe
            insert_query = text("""
                INSERT INTO invoices (id, order_id, pdf_url, status, created_at)
                VALUES (gen_random_uuid(), CAST(:order_id AS uuid), :path, 'generated', NOW())
            """)
            # Use a dummy path
            db.execute(insert_query, {"order_id": order_id, "path": "uploads/invoices/test.pdf"})
            print("Insert query simulated successfully (will rollback).")
            
            db.rollback()
        else:
            print("Failed to retrieve order data.")
            
    except Exception as e:
        print(f"ERROR: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    verify()
