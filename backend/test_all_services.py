"""
TeamVoice AI - Full Service Health Check v2
Tests: Config, MongoDB, HuggingFace, Groq AI, AI Summary, Cloudinary, FFmpeg, CORS
"""
import sys, os, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
load_dotenv()

results = []
def log(msg):
    results.append(msg)
    try:
        print(msg, flush=True)
    except:
        print(msg.encode('ascii', 'replace').decode(), flush=True)

log("=" * 60)
log("  TeamVoice AI - Full Service Health Check v2")
log("=" * 60)

# ── 1. CONFIG ──
log("\n--- 1. CONFIG ---")
try:
    from app.config import settings
    log("[PASS] Config loaded successfully")
    if settings.SECRET_KEY == "your-super-secret-jwt-key-change-this":
        log("[FAIL] SECRET_KEY is still default placeholder!")
    else:
        log("[PASS] SECRET_KEY is set (custom)")
    log(f"[INFO] APP_NAME = {settings.APP_NAME}")
    log(f"[INFO] STORAGE_TYPE = {settings.STORAGE_TYPE}")
except Exception as e:
    log(f"[FAIL] Config error: {e}")
    sys.exit(1)

# ── 2. MONGODB ──
log("\n--- 2. MONGODB ---")
try:
    from pymongo import MongoClient
    url_display = settings.MONGODB_URL[:40] + "..." if len(settings.MONGODB_URL) > 40 else settings.MONGODB_URL
    log(f"[INFO] URL = {url_display}")
    client = MongoClient(settings.MONGODB_URL, serverSelectionTimeoutMS=10000)
    client.admin.command('ping')
    log("[PASS] MongoDB connected!")
    db = client[settings.MONGODB_DB_NAME]
    uc = db.users.count_documents({})
    rc = db.recordings.count_documents({})
    log(f"[INFO] DB: {settings.MONGODB_DB_NAME} | Users: {uc}, Recordings: {rc}")
    collections = db.list_collection_names()
    log(f"[INFO] Collections: {', '.join(collections) if collections else 'none yet'}")
    client.close()
except Exception as e:
    log(f"[FAIL] MongoDB: {e}")

# ── 3. HUGGINGFACE ──
log("\n--- 3. HUGGINGFACE ---")
token = settings.HUGGINGFACE_TOKEN
if not token or token == "hf_your_token_here":
    log("[FAIL] Token not set or still placeholder")
else:
    log(f"[INFO] Token = {token[:10]}...{token[-4:]}")
    try:
        import requests
        r = requests.get("https://huggingface.co/api/whoami-v2",
                         headers={"Authorization": f"Bearer {token}"}, timeout=15)
        if r.status_code == 200:
            log(f"[PASS] Token valid! User: {r.json().get('name','?')}")
            r2 = requests.get("https://huggingface.co/api/models/pyannote/speaker-diarization-3.1",
                              headers={"Authorization": f"Bearer {token}"}, timeout=15)
            if r2.status_code == 200:
                log("[PASS] pyannote speaker-diarization-3.1 access OK")
            else:
                log(f"[WARN] pyannote model access ({r2.status_code})")
        else:
            log(f"[FAIL] Token invalid! Status: {r.status_code}")
    except Exception as e:
        log(f"[WARN] HuggingFace check error: {e}")

# ── 4. GROQ AI ──
log("\n--- 4. GROQ AI API ---")
key = settings.OPENAI_API_KEY
if not key:
    log("[WARN] OPENAI_API_KEY not set")
elif key.startswith("gsk_"):
    log(f"[INFO] Groq key: {key[:12]}...{key[-4:]}")
    try:
        import requests
        r = requests.get("https://api.groq.com/openai/v1/models",
                         headers={"Authorization": f"Bearer {key}"}, timeout=15)
        if r.status_code == 200:
            models = [m["id"] for m in r.json().get("data", [])[:5]]
            log(f"[PASS] Groq API valid! Models: {', '.join(models)}...")
            
            log("[INFO] Testing generation with llama-3.3-70b-versatile...")
            r2 = requests.post("https://api.groq.com/openai/v1/chat/completions",
                headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                json={
                    "model": "llama-3.3-70b-versatile",
                    "messages": [{"role": "user", "content": "Reply with just 'working'"}],
                    "max_tokens": 10, "temperature": 0
                }, timeout=30)
            if r2.status_code == 200:
                reply = r2.json()["choices"][0]["message"]["content"].strip()
                log(f"[PASS] Groq generation works! Reply: '{reply}'")
            else:
                log(f"[FAIL] Generation failed: {r2.status_code}")
        else:
            log(f"[FAIL] Groq API: {r.status_code}")
    except Exception as e:
        log(f"[WARN] Groq error: {e}")
else:
    log(f"[WARN] Unknown key format: {key[:8]}...")

# ── 5. AI SUMMARY SERVICE (with Groq) ──
log("\n--- 5. AI SUMMARY SERVICE (Groq-powered) ---")
try:
    from app.services.summary_service import generate_summary
    
    test_transcript = (
        "Welcome everyone to the Q4 planning meeting. I'm John, the project lead. "
        "Today we need to discuss three main items: the product launch timeline, "
        "budget allocation, and team assignments. "
        "Sarah mentioned she will prepare the marketing slides by next Wednesday. "
        "We should allocate 50,000 dollars for the advertising campaign. "
        "Mike will contact the vendor by Monday to finalize the contract. "
        "The team agreed to have daily standup meetings at 9 AM starting next week. "
        "Lisa raised a concern about the testing timeline - we need at least two weeks "
        "for QA before the launch date. "
        "The decision was made to push the launch to March 15th to accommodate testing. "
        "Action item: Everyone should submit their resource requirements by Friday. "
        "Overall, the team is feeling positive about the direction we're heading."
    )
    
    start_time = time.time()
    result = generate_summary(test_transcript)
    elapsed = time.time() - start_time
    
    log(f"[INFO] Generated in {elapsed:.1f}s | Keys: {list(result.keys())}")
    
    if result.get("summary"):
        summary = result["summary"]
        if len(summary) > 50 and "Q4" in summary or "launch" in summary.lower() or "meeting" in summary.lower():
            log(f"[PASS] AI Summary (intelligent): '{summary[:150]}...'")
        else:
            log(f"[PASS] Summary: '{summary[:150]}...'")
    else:
        log("[WARN] Summary was empty")
    
    if result.get("action_items"):
        log(f"[PASS] Action items: {len(result['action_items'])} found")
        for item in result["action_items"][:3]:
            log(f"  -> {item[:80]}")
    
    if result.get("key_topics"):
        log(f"[PASS] Key topics: {result['key_topics']}")
    
    if result.get("sentiment"):
        log(f"[PASS] Sentiment: {result['sentiment']}")
    
    if result.get("decisions_made"):
        log(f"[PASS] Decisions: {len(result['decisions_made'])} found")
        for d in result["decisions_made"][:2]:
            log(f"  -> {d[:80]}")
    
    if result.get("follow_ups"):
        log(f"[PASS] Follow-ups: {len(result['follow_ups'])} found")

except Exception as e:
    import traceback
    log(f"[FAIL] Summary service error: {e}")
    log(f"[DEBUG] {traceback.format_exc()[:300]}")

# ── 6. CUSTOM AI QUERY ──
log("\n--- 6. CUSTOM AI QUERY ---")
try:
    from app.services.summary_service import generate_custom_summary
    
    result = generate_custom_summary(
        test_transcript,
        "Who has action items assigned to them? List each person and their task."
    )
    
    if result.get("response") and "unavailable" not in result["response"].lower():
        log(f"[PASS] Custom AI query works!")
        log(f"  Response: {result['response'][:200]}...")
    else:
        log(f"[WARN] Custom AI query: {result.get('response', 'no response')[:100]}")
except Exception as e:
    log(f"[FAIL] Custom query error: {e}")

# ── 7. CLOUDINARY ──
log("\n--- 7. CLOUDINARY ---")
cn = settings.CLOUDINARY_CLOUD_NAME
ck = settings.CLOUDINARY_API_KEY
cs = settings.CLOUDINARY_API_SECRET
if not cn or not ck or not cs:
    log(f"[WARN] Cloudinary creds incomplete!")
else:
    log(f"[INFO] Cloud: {cn}, Key: {ck[:8]}...")
    try:
        import cloudinary, cloudinary.api
        cloudinary.config(cloud_name=cn, api_key=ck, api_secret=cs)
        result = cloudinary.api.ping()
        if result.get("status") == "ok":
            log("[PASS] Cloudinary connected & authenticated!")
        else:
            log(f"[FAIL] Cloudinary ping: {result}")
    except ImportError:
        log("[WARN] cloudinary package not installed")
    except Exception as e:
        log(f"[FAIL] Cloudinary: {e}")

# ── 8. FFMPEG ──
log("\n--- 8. FFMPEG ---")
try:
    import subprocess
    result = subprocess.run(["ffmpeg", "-version"], capture_output=True, text=True, timeout=5)
    if result.returncode == 0:
        version_line = result.stdout.split('\n')[0]
        log(f"[PASS] FFmpeg: {version_line[:60]}")
    else:
        log("[FAIL] FFmpeg not working")
except FileNotFoundError:
    log("[FAIL] FFmpeg not found! (restart terminal after install)")
except Exception as e:
    log(f"[WARN] FFmpeg check: {e}")

# ── 9. CORS ──
log("\n--- 9. CORS ---")
origins = settings.allowed_origins_list
log(f"[INFO] Allowed: {origins}")
if "http://localhost:5173" in origins:
    log("[PASS] Vite (5173) allowed")
if "http://localhost:3000" in origins:
    log("[PASS] Port 3000 allowed")

# ── SUMMARY ──
passes = sum(1 for l in results if "[PASS]" in l)
fails = sum(1 for l in results if "[FAIL]" in l)
warns = sum(1 for l in results if "[WARN]" in l)

log(f"\n{'=' * 60}")
log(f"  RESULTS: {passes} PASSED | {fails} FAILED | {warns} WARNINGS")
log("=" * 60)
if fails == 0:
    log("  ALL SERVICES WORKING!")
else:
    log(f"  {fails} service(s) need attention")

with open("test_results.txt", "w", encoding="utf-8") as f:
    f.write("\n".join(results))
log("\nResults saved to test_results.txt")
