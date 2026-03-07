import asyncio, sys, urllib.request, json
sys.path.insert(0, '.')

# First login to get token
login_data = json.dumps({"email": "admin@teamvoice.ai", "password": "AdminPass123!"}).encode('utf-8')
login_req = urllib.request.Request('http://localhost:8000/api/auth/login', data=login_data, headers={'Content-Type': 'application/json'})
login_resp = json.loads(urllib.request.urlopen(login_req).read().decode())
token = login_resp['data']['token']
print(f"Token: {token[:20]}...")

# Reprocess the recording 
rec_id = "69aaa13c0147913b66d267bd"
reprocess_req = urllib.request.Request(
    f'http://localhost:8000/api/audio/reprocess/{rec_id}',
    data=b'',
    headers={'Authorization': f'Bearer {token}'},
    method='POST'
)
reprocess_resp = json.loads(urllib.request.urlopen(reprocess_req).read().decode())
print(f"Reprocess response: {reprocess_resp}")
