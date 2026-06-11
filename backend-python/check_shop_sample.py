from database import engine
from sqlalchemy import text

def check_shop():
    with engine.connect() as conn:
        r = conn.execute(text("SELECT * FROM shops WHERE id = '85e66e5f-8f58-4ec7-9411-430477a5702d'")).mappings().first()
        if r:
            print(dict(r))
        else:
            print("Shop not found.")

if __name__ == "__main__":
    check_shop()
