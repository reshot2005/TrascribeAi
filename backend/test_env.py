import asyncio, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

lines = []
def log(msg): lines.append(msg)

async def main():
    log("=" * 60)
    log("  TeamVoice AI - Full Service Health Check")
    log("=" * 60)
    
    # 1. Config
    log("\n--- 1. CONFIG ---")
    try:
        from app.config import settings
        log(f"[PASS] Config loaded")
        if settings.SECRET_KEY == "your-super-secret-jwt-key-change-this":
            log(f"[FAIL] SECRET_KEY is still default placeholder!")
        else:
            log(f"[PASS] SECRET_KEY is set (custom)")
        log(f"[INFO] STORAGE_TYPE = {settings.STORAGE_TYPE}")
    except Exception as e:
        log(f"[FAIL] Config error: {e}")
        return
    
    # 2. MongoDB
    log("\n--- 2. MONGODB ---")
    try:
        from motor.motor_asyncio import AsyncIOMotorClient
        url_display = settings.MONGODB_URL[:30] + "..." if len(settings.MONGODB_URL) > 30 else settings.MONGODB_URL
        log(f"[INFO] URL = {url_display}")
        client = AsyncIOMotorClient(settings.MONGODB_URL, serverSelectionTimeoutMS=10000)
        await client.admin.command('ping')
        log("[PASS] MongoDB connected!")
        db = client[settings.MONGODB_DB_NAME]
        uc = await db.users.count_documents({})
        rc = await db.recordings.count_documents({})
        log(f"[INFO] DB: {settings.MONGODB_DB_NAME} | Users: {uc}, Recordings: {rc}")
        
        # List collections
        collections = await db.list_collection_names()
        log(f"[INFO] Collections: {', '.join(collections) if collections else 'none'}")
        client.close()
    except Exception as e:
        log(f"[FAIL] MongoDB: {e}")
    
    # 3. HuggingFace
    log("\n--- 3. HUGGINGFACE ---")
    token = settings.HUGGINGFACE_TOKEN
    if not token or token == "hf_your_token_here":
        log("[FAIL] Token not set or still placeholder")
    else:
        log(f"[INFO] Token = {token[:10]}...{token[-4:]}")
        try:
            import requests
            r = requests.get("https://huggingface.co/api/whoami-v2", headers={"Authorization": f"Bearer {token}"}, timeout=15)
            if r.status_code == 200:
                user_info = r.json()
                log(f"[PASS] Token valid! User: {user_info.get('name','?')}")
                
                # Check pyannote model access
                r2 = requests.get("https://huggingface.co/api/models/pyannote/speaker-diarization-3.1", headers={"Authorization": f"Bearer {token}"}, timeout=15)
                if r2.status_code == 200:
                    log("[PASS] pyannote speaker-diarization-3.1 model access OK")
                else:
                    log(f"[WARN] pyannote model access issue ({r2.status_code}) - may need to accept license at huggingface.co")
                    
                # Check segmentation model too
                r3 = requests.get("https://huggingface.co/api/models/pyannote/segmentation-3.0", headers={"Authorization": f"Bearer {token}"}, timeout=15)
                if r3.status_code == 200:
                    log("[PASS] pyannote segmentation-3.0 model access OK")
                else:
                    log(f"[WARN] pyannote segmentation model access issue ({r3.status_code})")
            else:
                log(f"[FAIL] Token invalid! Status: {r.status_code}")
        except Exception as e:
            log(f"[WARN] Could not verify HuggingFace: {e}")
    
    # 4. Groq API (key starts with gsk_)
    log("\n--- 4. GROQ AI (for summaries) ---")
    key = settings.OPENAI_API_KEY
    if not key:
        log("[WARN] OPENAI_API_KEY not set (AI summaries disabled)")
    elif key.startswith("gsk_"):
        log(f"[INFO] Detected Groq API key: {key[:12]}...{key[-4:]}")
        try:
            import requests
            # Test Groq API
            r = requests.get("https://api.groq.com/openai/v1/models", 
                headers={"Authorization": f"Bearer {key}"}, timeout=15)
            if r.status_code == 200:
                models = r.json().get("data", [])
                model_names = [m["id"] for m in models[:5]]
                log(f"[PASS] Groq API key valid! Available models: {', '.join(model_names)}...")
                
                # Test actual generation 
                log("[INFO] Testing AI generation with llama-3.3-70b-versatile...")
                r2 = requests.post("https://api.groq.com/openai/v1/chat/completions",
                    headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                    json={
                        "model": "llama-3.3-70b-versatile",
                        "messages": [{"role": "user", "content": "Reply with just the word 'working'"}],
                        "max_tokens": 10,
                        "temperature": 0
                    },
                    timeout=30)
                if r2.status_code == 200:
                    reply = r2.json()["choices"][0]["message"]["content"].strip()
                    log(f"[PASS] Groq AI generation works! Reply: '{reply}'")
                else:
                    log(f"[FAIL] Groq generation failed: {r2.status_code} - {r2.text[:200]}")
            elif r.status_code == 401:
                log("[FAIL] Groq API key is INVALID!")
            else:
                log(f"[FAIL] Groq API status: {r.status_code} - {r.text[:200]}")
        except Exception as e:
            log(f"[WARN] Groq API check error: {e}")
    elif key.startswith("sk-"):
        log(f"[INFO] Detected OpenAI API key: {key[:12]}...{key[-4:]}")
        try:
            import requests
            r = requests.get("https://api.openai.com/v1/models", headers={"Authorization": f"Bearer {key}"}, timeout=15)
            if r.status_code == 200:
                log("[PASS] OpenAI key valid!")
            elif r.status_code == 401:
                log("[FAIL] OpenAI key is INVALID!")
            else:
                log(f"[FAIL] OpenAI status: {r.status_code}")
        except Exception as e:
            log(f"[WARN] OpenAI check error: {e}")
    else:
        log(f"[WARN] Unknown API key format: {key[:8]}... (expected gsk_ for Groq or sk- for OpenAI)")
    
    # 5. AI Summary Service Test
    log("\n--- 5. AI SUMMARY SERVICE ---")
    try:
        from app.services.summary_service import generate_summary
        test_transcript = (
            "John said we need to finish the project by next Friday. "
            "Sarah will prepare the presentation slides. "
            "The budget was discussed and we should allocate 50000 dollars. "
            "Mike will contact the vendor by Monday. "
            "The team agreed to have daily standups at 9 AM."
        )
        result = generate_summary(test_transcript)
        log(f"[INFO] Summary service returned keys: {list(result.keys())}")
        if result.get("summary"):
            summary_preview = result["summary"][:100] + "..." if len(result.get("summary","")) > 100 else result["summary"]
            log(f"[PASS] Summary generated: '{summary_preview}'")
        else:
            log("[WARN] Summary was empty")
        if result.get("action_items"):
            log(f"[PASS] Action items found: {len(result['action_items'])} items")
            for item in result["action_items"][:3]:
                log(f"  -> {item[:80]}")
        else:
            log("[WARN] No action items extracted")
    except Exception as e:
        log(f"[FAIL] Summary service error: {e}")
    
    # 6. Cloudinary
    log("\n--- 6. CLOUDINARY ---")
    cn = settings.CLOUDINARY_CLOUD_NAME
    ck = settings.CLOUDINARY_API_KEY
    cs = settings.CLOUDINARY_API_SECRET
    if not cn or not ck or not cs:
        log(f"[WARN] Cloudinary creds incomplete! Name:{'Y' if cn else 'N'} Key:{'Y' if ck else 'N'} Secret:{'Y' if cs else 'N'}")
    else:
        log(f"[INFO] Cloud: {cn}, Key: {ck[:8]}...")
        try:
            import cloudinary, cloudinary.api
            cloudinary.config(cloud_name=cn, api_key=ck, api_secret=cs)
            result = cloudinary.api.ping()
            if result.get("status") == "ok":
                log("[PASS] Cloudinary connected & authenticated!")
                # Check usage
                try:
                    usage = cloudinary.api.usage()
                    plan = usage.get("plan", "unknown")
                    used = usage.get("credits", {}).get("used_percent", "?")
                    log(f"[INFO] Plan: {plan}, Credits used: {used}%")
                except:
                    pass
            else:
                log(f"[FAIL] Cloudinary ping: {result}")
        except ImportError:
            log("[WARN] cloudinary package not installed - run: pip install cloudinary")
        except Exception as e:
            log(f"[FAIL] Cloudinary: {e}")
    
    if settings.STORAGE_TYPE == "local":
        log(f"[INFO] Storage mode: LOCAL (Cloudinary tested but not active for uploads)")
        p = os.path.abspath(settings.UPLOAD_DIR)
        if os.path.exists(p):
            file_count = len(os.listdir(p))
            log(f"[PASS] Upload dir exists: {p} ({file_count} items)")
        else:
            log(f"[WARN] Upload dir missing: {p} (will be created on first upload)")
    else:
        log(f"[INFO] Storage mode: CLOUDINARY (active for uploads)")
    
    # 7. Redis
    log("\n--- 7. REDIS ---")
    rurl = settings.REDIS_URL
    if not rurl:
        log("[WARN] Redis not configured (optional)")
    else:
        log(f"[INFO] URL = {rurl}")
        try:
            import redis
            r = redis.from_url(rurl, socket_connect_timeout=3)
            if r.ping():
                log(f"[PASS] Redis connected! Version: {r.info('server').get('redis_version','?')}")
            r.close()
        except ImportError:
            log("[WARN] redis package not installed (optional)")
        except Exception as e:
            log(f"[WARN] Redis not reachable (optional): {str(e)[:80]}")
    
    # 8. CORS
    log("\n--- 8. CORS ---")
    origins = settings.allowed_origins_list
    log(f"[INFO] Allowed origins: {origins}")
    if "http://localhost:5173" in origins:
        log("[PASS] Vite dev server (5173) allowed")
    else:
        log("[WARN] localhost:5173 not in allowed origins!")
    if "http://localhost:3000" in origins:
        log("[PASS] Port 3000 allowed")
    
    # 9. FFmpeg check
    log("\n--- 9. FFMPEG ---")
    try:
        import subprocess
        result = subprocess.run(["ffmpeg", "-version"], capture_output=True, text=True, timeout=5)
        if result.returncode == 0:
            version_line = result.stdout.split('\n')[0]
            log(f"[PASS] FFmpeg available: {version_line[:60]}")
        else:
            log("[FAIL] FFmpeg not working properly")
    except FileNotFoundError:
        log("[FAIL] FFmpeg not found! Audio processing will fail. Install: https://ffmpeg.org/download.html")
    except Exception as e:
        log(f"[WARN] FFmpeg check error: {e}")
    
    # Summary
    passes = sum(1 for l in lines if "[PASS]" in l)
    fails = sum(1 for l in lines if "[FAIL]" in l)
    warns = sum(1 for l in lines if "[WARN]" in l)
    
    log(f"\n{'=' * 60}")
    log(f"  RESULTS: {passes} PASSED | {fails} FAILED | {warns} WARNINGS")
    log("=" * 60)
    if fails == 0:
        log("  ✅ All critical services working!")
    else:
        log(f"  ❌ {fails} service(s) need attention")

asyncio.run(main())

# Write results
with open("test_results.txt", "w", encoding="utf-8") as f:
    f.write("\n".join(lines))

# Also print
for l in lines:
    try:
        print(l)
    except:
        print(l.encode('ascii', 'replace').decode())
