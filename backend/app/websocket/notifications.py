from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import Dict, List
import logging
import json

router = APIRouter()
logger = logging.getLogger(__name__)

class NotificationManager:
    def __init__(self):
        # Maps user_id to a list of connected WebSockets
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = []
        self.active_connections[user_id].append(websocket)
        logger.info(f"User {user_id} connected via WebSocket for notifications")

    def disconnect(self, websocket: WebSocket, user_id: str):
        if user_id in self.active_connections and websocket in self.active_connections[user_id]:
            self.active_connections[user_id].remove(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]
        logger.info(f"User {user_id} disconnected from WebSocket notifications")

    async def send_to_user(self, user_id: str, message: dict):
        if user_id in self.active_connections:
            # We want to wait for delivery or fail smoothly
            failed_sockets = []
            for websocket in self.active_connections[user_id]:
                try:
                    await websocket.send_json(message)
                except Exception as e:
                    logger.error(f"Failed to send WS message to {user_id}: {e}")
                    failed_sockets.append(websocket)
            
            for ws in failed_sockets:
                self.disconnect(ws, user_id)

notification_manager = NotificationManager()

@router.websocket("/ws/notifications/{user_id}")
async def notify_endpoint(websocket: WebSocket, user_id: str):
    await notification_manager.connect(websocket, user_id)
    try:
        while True:
            # Keep connection alive, listen for pings
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        notification_manager.disconnect(websocket, user_id)
    except Exception as e:
        logger.error(f"Notification WS disconnected unexpectedly: {e}")
        notification_manager.disconnect(websocket, user_id)
