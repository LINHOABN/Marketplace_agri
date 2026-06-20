import psycopg2
import os
from dotenv import load_dotenv

env_path = r'C:\Users\Dr Haoua Madeleine\Desktop\6\backend-python\ .env'.replace(' ', '') # Handle space if any, but wait
env_path = r'C:\Users\Dr Haoua Madeleine\Desktop\6\backend-python\.env'
load_dotenv(env_path)

def get_enums():
    try:
        conn = psycopg2.connect(os.getenv('DATABASE_URL'))
        cur = conn.cursor()
        cur.execute("SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'invoice_status';")
        print(cur.fetchall())
        cur.close()
        conn.close()
    except Exception as e:
        print(f"ERROR: {e}")

if __name__ == "__main__":
    get_enums()
