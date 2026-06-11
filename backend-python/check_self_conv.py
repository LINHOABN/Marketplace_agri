from database import engine
from sqlalchemy import text

def check_self_conv():
    with engine.connect() as conn:
        r = conn.execute(text("SELECT count(*) FROM conversations WHERE user1_id = user2_id")).scalar()
        print(f"{r} self-conversations found")

if __name__ == "__main__":
    check_self_conv()
