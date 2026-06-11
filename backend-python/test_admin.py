import requests

# 1. Login to get token
login_res = requests.post("http://127.0.0.1:8000/auth/login", json={
    "email": "admin@agrimarche.com",
    "password": "adminpassword123"
})
print(f"Login: {login_res.status_code}")
token = login_res.json().get("access_token")

# 2. Test admin routes
headers = {"Authorization": f"Bearer {token}"}

for route in ["/admin/stats", "/admin/stats/charts", "/admin/disputes"]:
    r = requests.get(f"http://127.0.0.1:8000{route}", headers=headers)
    print(f"\n{route}: {r.status_code}")
    print(r.text[:300])
