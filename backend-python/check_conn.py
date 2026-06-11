from database import engine
from sqlalchemy import text

def check_product_shop_user():
    with engine.connect() as conn:
        print("Checking sample product/shop/user connection...")
        query = text("""
            SELECT p.id as p_id, s.id as s_id, s.seller_id as u_id
            FROM products p
            JOIN shops s ON p.shop_id = s.id
            LIMIT 1
        """)
        r = conn.execute(query).mappings().first()
        if r:
            print(dict(r))
        else:
            print("No matching product/shop found.")

if __name__ == "__main__":
    check_product_shop_user()
