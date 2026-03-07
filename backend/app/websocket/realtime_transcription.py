from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import Dict
import logging
import asyncio
import uuid
import os
from pathlib import Path
from app.config import settings
import speech_recognition as sr

router = APIRouter()
logger = logging.getLogger(__name__)

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}

    async def connect(self, websocket: WebSocket, client_id: str):
        await websocket.accept()
        self.active_connections[client_id] = websocket

    def disconnect(self, client_id: str):
        if client_id in self.active_connections:
            del self.active_connections[client_id]

manager = ConnectionManager()

@router.websocket("/ws/transcribe/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    await manager.connect(websocket, client_id)
    
    # temp file setup
    temp_dir = Path(settings.UPLOAD_DIR) / "ws_temp"
    os.makedirs(temp_dir, exist_ok=True)
    temp_file = temp_dir / f"{client_id}_{uuid.uuid4().hex}.wav"
    recognizer = sr.Recognizer()
    
    try:
        await websocket.send_json({"type": "status", "status": "listening"})
        
        while True:
            # Receive audio chunk
            data = await websocket.receive_bytes()
            
            # Write accumulated audio data
            with open(temp_file, "ab") as f:
                f.write(data)
                
            try:
                # Try to transcribe the accumulated audio
                with sr.AudioFile(str(temp_file)) as source:
                    audio_data = recognizer.record(source)
                
                text = recognizer.recognize_google(audio_data, show_all=False)
                    
                await websocket.send_json({
                    "type": "transcript",
                    "text": text.strip(),
                    "speaker": "Unknown",
                    "confidence": 0.85,
                    "timestamp": 0.0
                })
            except sr.UnknownValueError:
                pass  # Could not understand - wait for more data
            except Exception as e:
                logger.error(f"WS Transcribe error: {e}")
                
    except WebSocketDisconnect:
        manager.disconnect(client_id)
    finally:
        if temp_file.exists(): 
            temp_file.unlink()
