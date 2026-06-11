import requests

def test_endpoint():
    # Attempt to hit the endpoint locally
    try:
        # Note: This will likely fail with 401/403 because we don't have a token here, 
        # but it shouldn't return 404 if the route exists.
        url = "http://127.0.0.1:8000/chat/conversations"
        resp = requests.post(url)
        print(f"POST {url} -> {resp.status_code}")
        
        url_get = "http://127.0.0.1:8000/chat/conversations"
        resp_get = requests.get(url_get)
        print(f"GET {url_get} -> {resp_get.status_code}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_endpoint()
