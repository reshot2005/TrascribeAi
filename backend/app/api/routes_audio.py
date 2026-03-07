from fastapi import APIRouter, Depends, UploadFile, File, Form, BackgroundTasks
from fastapi.responses import FileResponse, StreamingResponse
from app.database.mongodb import get_db
from app.utils.response_utils import success_response, error_response
from app.middleware.auth_middleware import get_current_user
from app.utils.file_storage import save_upload_file, delete_file
from bson import ObjectId
from datetime import datetime
from pathlib import Path
from app.config import settings
import os

from app.services.transcription_pipeline import run_pipeline

router = APIRouter()

@router.post("/upload")
async def upload_audio(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    title: str = Form(None),
    description: str = Form(None),
    target_user_id: str = Form(None),
    current_user=Depends(get_current_user),
    db=Depends(get_db)
):
    valid_exts = [".wav", ".mp3", ".m4a", ".webm", ".ogg"]
    if not any(file.filename.lower().endswith(ext) for ext in valid_exts):
        return error_response("Invalid audio format")
        
    file_path = await save_upload_file(file)
    
    upload_user_id = target_user_id if target_user_id else current_user["_id"]
    
    doc = {
        "user_id": ObjectId(upload_user_id),
        "team_id": ObjectId(current_user["team_id"]) if current_user.get("team_id") else None,
        "title": title or file.filename,
        "description": description or "",
        "audio_url": f"/uploads/{file.filename}",
        "audio_filename": file.filename,
        "duration": 0.0,
        "file_size": os.path.getsize(file_path),
        "status": "uploaded",
        "step": "pending",
        "transcript_raw": "",
        "speakers": [],
        "word_timestamps": [],
        "summary": None,
        "action_items": [],
        "speaker_stats": {},
        "language": "unknown",
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    res = await db.recordings.insert_one(doc)
    recording_id = str(res.inserted_id)
    
    # Trigger transcription pipeline in background
    background_tasks.add_task(run_pipeline, recording_id, file_path)
    
    return success_response({"recording_id": recording_id})

@router.get("/recordings")
async def get_recordings(user_id: str = None, team_id: str = None, limit: int = 20, skip: int = 0, current_user=Depends(get_current_user), db=Depends(get_db)):
    query = {}
    if user_id: query["user_id"] = ObjectId(user_id)
    elif team_id: query["team_id"] = ObjectId(team_id)
    else: query["user_id"] = ObjectId(current_user["_id"])
    
    cursor = db.recordings.find(query).sort("created_at", -1).skip(skip).limit(limit)
    recs = []
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        doc["user_id"] = str(doc["user_id"])
        if doc.get("team_id"): doc["team_id"] = str(doc["team_id"])
        recs.append(doc)
    return success_response(recs)

@router.get("/recordings/{recording_id}")
async def get_recording(recording_id: str, current_user=Depends(get_current_user), db=Depends(get_db)):
    doc = await db.recordings.find_one({"_id": ObjectId(recording_id)})
    if not doc:
        return error_response("Recording not found")
    doc["_id"] = str(doc["_id"])
    doc["user_id"] = str(doc["user_id"])
    if doc.get("team_id"): doc["team_id"] = str(doc["team_id"])
    return success_response(doc)

@router.delete("/recordings/{recording_id}")
async def delete_recording(recording_id: str, current_user=Depends(get_current_user), db=Depends(get_db)):
    doc = await db.recordings.find_one({"_id": ObjectId(recording_id)})
    if not doc:
        return error_response("Recording not found")
        
    file_path = Path(settings.UPLOAD_DIR) / doc.get("audio_filename", "")
    await delete_file(file_path)
    await db.recordings.delete_one({"_id": ObjectId(recording_id)})
    await db.search_index.delete_many({"recording_id": ObjectId(recording_id)})
    
    return success_response(message="Deleted successfully")

@router.get("/stream/{recording_id}")
async def stream_audio(recording_id: str, db=Depends(get_db)):
    doc = await db.recordings.find_one({"_id": ObjectId(recording_id)})
    if not doc:
        return error_response("Recording not found")
        
    file_path = Path(settings.UPLOAD_DIR) / doc["audio_filename"]
    if not file_path.exists():
        return error_response("File not found on disk")
        
    return FileResponse(file_path)

@router.post("/reprocess/{recording_id}")
async def reprocess_recording(recording_id: str, background_tasks: BackgroundTasks, current_user=Depends(get_current_user), db=Depends(get_db)):
    doc = await db.recordings.find_one({"_id": ObjectId(recording_id)})
    if not doc:
        return error_response("Recording not found")
    
    file_path = Path(settings.UPLOAD_DIR) / doc.get("audio_filename", "")
    if not file_path.exists():
        return error_response("Audio file missing on disk")
    
    # Reset status
    await db.recordings.update_one(
        {"_id": ObjectId(recording_id)},
        {"$set": {"status": "uploaded", "step": "pending", "error_message": None}}
    )
    
    # Trigger pipeline
    background_tasks.add_task(run_pipeline, recording_id, file_path)
    return success_response({"recording_id": recording_id}, message="Reprocessing started")
