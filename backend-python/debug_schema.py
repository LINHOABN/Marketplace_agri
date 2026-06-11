from database import engine
from sqlalchemy import text

def check():
    with engine.connect() as conn:
        print("\nCONVERSATIONS:")
        r = conn.execute(text("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'conversations'"))
        for i in r:
            print(i)
        
        print("\nMESSAGES:")
        r = conn.execute(text("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'messages'"))
        for i in r:
            print(i)

if __name__ == "__main__":
    check()
