from database import engine
from sqlalchemy import text

def find_conv(p_id):
    with engine.connect() as conn:
        r = conn.execute(text("SELECT id FROM conversations WHERE product_id = CAST(:p_id AS uuid)"), {"p_id": p_id}).mappings().all()
        print([str(i['id']) for i in r])

if __name__ == "__main__":
    find_conv("46598272-40de-4ba1-a157-1201f656d603")
