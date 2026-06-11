from database import engine
from sqlalchemy import text

def check_triggers():
    with engine.connect() as conn:
        print("TRIGGERS:")
        r = conn.execute(text("SELECT tgname FROM pg_trigger WHERE tgrelid = 'conversations'::regclass")).mappings().all()
        for i in r:
            print(f"  {i['tgname']}")

if __name__ == "__main__":
    check_triggers()
