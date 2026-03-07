from fastapi import APIRouter, Depends, BackgroundTasks
from app.database.mongodb import get_db
from app.utils.response_utils import success_response, error_response
from app.middleware.auth_middleware import get_current_user
from bson import ObjectId
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from app.services.transcription_pipeline import run_pipeline
from app.services.summary_service import generate_summary, generate_custom_summary
from pathlib import Path
from app.config import settings

router = APIRouter()

class AssignSpeakerRequest(BaseModel):
    recording_id: str
    speaker_label: str
    user_id: str

class AskAIRequest(BaseModel):
    prompt: str

@router.post("/process/{recording_id}")
async def process_recording(recording_id: str, background_tasks: BackgroundTasks, current_user=Depends(get_current_user), db=Depends(get_db)):
    doc = await db.recordings.find_one({"_id": ObjectId(recording_id)})
    if not doc:
        return error_response("Recording not found")
        
    file_path = Path(settings.UPLOAD_DIR) / doc["audio_filename"]
    if not file_path.exists():
        return error_response("Audio file missing")
        
    background_tasks.add_task(run_pipeline, recording_id, file_path)
    return success_response({"job_id": recording_id}, message="Processing started")

@router.get("/status/{recording_id}")
async def get_status(recording_id: str, current_user=Depends(get_current_user), db=Depends(get_db)):
    doc = await db.recordings.find_one({"_id": ObjectId(recording_id)}, {"status": 1, "step": 1})
    if not doc:
        return error_response("Recording not found")
    
    return success_response({"status": doc.get("status"), "current_step": doc.get("step")})

@router.get("/result/{recording_id}")
async def get_result(recording_id: str, current_user=Depends(get_current_user), db=Depends(get_db)):
    doc = await db.recordings.find_one({"_id": ObjectId(recording_id)})
    if not doc:
        return error_response("Recording not found")
    return success_response({
        "status": doc.get("status"),
        "transcript_raw": doc.get("transcript_raw"),
        "speakers": doc.get("speakers"),
        "word_timestamps": doc.get("word_timestamps"),
        "summary": doc.get("summary"),
        "action_items": doc.get("action_items", []),
        "key_topics": doc.get("key_topics", []),
        "sentiment": doc.get("sentiment", "neutral"),
        "decisions_made": doc.get("decisions_made", []),
        "follow_ups": doc.get("follow_ups", [])
    })

@router.post("/regenerate-summary/{recording_id}")
async def regenerate_summary(recording_id: str, current_user=Depends(get_current_user), db=Depends(get_db)):
    """Regenerate AI summary for an existing transcription."""
    doc = await db.recordings.find_one({"_id": ObjectId(recording_id)})
    if not doc:
        return error_response("Recording not found")
    
    transcript = doc.get("transcript_raw", "")
    if not transcript:
        return error_response("No transcript available - process the recording first")
    
    # Generate fresh AI summary
    summary_result = generate_summary(transcript)
    
    # Update in database
    await db.recordings.update_one(
        {"_id": ObjectId(recording_id)},
        {"$set": {
            "summary": summary_result["summary"],
            "action_items": summary_result.get("action_items", []),
            "key_topics": summary_result.get("key_topics", []),
            "sentiment": summary_result.get("sentiment", "neutral"),
            "decisions_made": summary_result.get("decisions_made", []),
            "follow_ups": summary_result.get("follow_ups", []),
            "updated_at": datetime.utcnow()
        }}
    )
    
    return success_response({
        "summary": summary_result["summary"],
        "action_items": summary_result.get("action_items", []),
        "key_topics": summary_result.get("key_topics", []),
        "sentiment": summary_result.get("sentiment", "neutral"),
        "decisions_made": summary_result.get("decisions_made", []),
        "follow_ups": summary_result.get("follow_ups", [])
    }, message="AI summary regenerated successfully")

@router.post("/ask-ai/{recording_id}")
async def ask_ai_about_transcript(recording_id: str, req: AskAIRequest, current_user=Depends(get_current_user), db=Depends(get_db)):
    """Ask the AI any question about a specific transcript."""
    doc = await db.recordings.find_one({"_id": ObjectId(recording_id)})
    if not doc:
        return error_response("Recording not found")
    
    transcript = doc.get("transcript_raw", "")
    if not transcript:
        return error_response("No transcript available")
    
    result = generate_custom_summary(transcript, req.prompt)
    return success_response(result, message="AI analysis complete")

@router.post("/assign-speaker")
async def assign_speaker(req: AssignSpeakerRequest, current_user=Depends(get_current_user), db=Depends(get_db)):
    user = await db.users.find_one({"_id": ObjectId(req.user_id)})
    if not user: return error_response("User not found")
    
    res = await db.recordings.update_one(
        {
            "_id": ObjectId(req.recording_id), 
            "speakers.speaker_label": req.speaker_label
        },
        {"$set": {"speakers.$[elem].speaker_name": user["name"]}},
        array_filters=[{"elem.speaker_label": req.speaker_label}]
    )
    return success_response(message="Speaker assigned")
