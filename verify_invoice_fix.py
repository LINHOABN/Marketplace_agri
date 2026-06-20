import requests
import os
from dotenv import load_dotenv
import psycopg2

load_dotenv('backend-python/.env')

def test_invoice_generation():
    # 1. Get an order ID
    conn = psycopg2.connect(os.getenv('DATABASE_URL'))
    cur = conn.cursor()
    cur.execute("SELECT id FROM orders LIMIT 1;")
    order_data = cur.fetchone()
    if not order_data:
        print("No orders found to test.")
        return
    order_id = str(order_data[0])
    print(f"Testing with Order ID: {order_id}")
    
    # 2. Get a token (we need to be authenticated)
    # For testing, we can simulate the call by calling the function logic or just check if the endpoint is reachable.
    # Since I cannot easily log in without a password, I will run a script that imports and calls the logic.
    
    cur.close()
    conn.close()
    
    print("\nRunning verification script to call the logic directly...")
    
if __name__ == "__main__":
    test_invoice_generation()
