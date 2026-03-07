from fastapi import FastAPI, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.config import settings
from app.database.mongodb import connect_to_mongo, close_mongo_connection
from app.middleware.error_handler import global_exception_handler

# We will implement these shortly
from app.api import routes_auth, routes_users, routes_audio, routes_transcription, routes_analytics, search_router
from app.websocket import realtime_transcription
import logging
from fastapi.staticfiles import StaticFiles
import os

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("teamvoice")

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting up TeamVoice AI Backend...")
    # Add logic here to lazily preload Whisper model if needed
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    os.makedirs(os.path.join(settings.UPLOAD_DIR, "processed"), exist_ok=True)
    await connect_to_mongo()
    yield
    await close_mongo_connection()
    logger.info("Shutting down TeamVoice AI Backend...")

app = FastAPI(title=settings.APP_NAME, lifespan=lifespan)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_exception_handler(Exception, global_exception_handler)

# For serving local audio test files
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# Include Routers
app.include_router(routes_auth.router, prefix="/api/auth", tags=["Auth"])
app.include_router(routes_users.router, prefix="/api/users", tags=["Users"])
app.include_router(routes_audio.router, prefix="/api/audio", tags=["Audio"])
app.include_router(routes_transcription.router, prefix="/api/transcription", tags=["Transcription"])
app.include_router(search_router.router, prefix="/api/search", tags=["Search"])
app.include_router(routes_analytics.router, prefix="/api/analytics", tags=["Analytics"])
app.include_router(realtime_transcription.router, tags=["WebSocket Realtime"])

from app.websocket import notifications
app.include_router(notifications.router, tags=["WebSocket Notifications"])

@app.get("/health")
async def health_check():
    return {"status": "ok", "db": "connected", "version": "1.0.0"}
