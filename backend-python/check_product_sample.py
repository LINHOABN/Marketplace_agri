from database import engine
from sqlalchemy import text

def check_product():
    with engine.connect() as conn:
        r = conn.execute(text('SELECT * FROM products LIMIT 1')).mappings().first()
        if r:
            print(dict(r))
        else:
            print("No products found.")

if __name__ == "__main__":
    check_product()
