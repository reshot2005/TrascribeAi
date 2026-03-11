import requests
res = requests.post('http://127.0.0.1:8000/api/auth/login', json={'email': 'admin@teamvoice.ai', 'password': 'AdminPass123!'})
print(res.status_code)
print(res.text)
