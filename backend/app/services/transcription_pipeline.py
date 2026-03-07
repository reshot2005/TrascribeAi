import traceback
import logging
from pathlib import Path
from bson import ObjectId
from datetime import datetime
from app.database.mongodb import get_db

from app.utils.audio_processing import preprocess_audio
from app.services.whisper_service import transcribe_audio, detect_speakers_by_energy
from app.services.merge_service import merge_whisper_and_diarization
from app.services.summary_service import generate_summary
from app.websocket.notifications import notification_manager

logger = logging.getLogger(__name__)

async def update_status(db, recording_id: str, step: str, status: str = "processing", user_id: str = None):
    await db.recordings.update_one(
        {"_id": ObjectId(recording_id)},
        {"$set": {"status": status, "step": step, "updated_at": datetime.utcnow()}}
    )
    logger.info(f"Recording {recording_id} -> {status} [{step}]")
    if user_id:
        await notification_manager.send_to_user(str(user_id), {
            "type": "progress",
            "recording_id": str(recording_id),
            "status": status,
            "step": step
        })

async def run_pipeline(recording_id: str, raw_audio_path):
    raw_audio_path = Path(raw_audio_path)
    db = get_db()
    processed_audio_path = None
    try:
        recording = await db.recordings.find_one({"_id": ObjectId(recording_id)})
        user_id = str(recording["user_id"]) if recording else None

        # STEP 1: Preprocess audio to 16kHz mono WAV
        await update_status(db, recording_id, "preprocessing", user_id=user_id)
        processed_audio_path = await preprocess_audio(raw_audio_path)
        logger.info(f"Preprocessed audio: {processed_audio_path}")
        
        # STEP 2: Transcribe with Google Speech Recognition
        await update_status(db, recording_id, "transcription", user_id=user_id)
        whisper_result = transcribe_audio(str(processed_audio_path))
        logger.info(f"Transcription complete: {len(whisper_result['transcript_raw'])} chars")
        
        # STEP 3: Speaker diarization (energy-based)
        await update_status(db, recording_id, "diarization", user_id=user_id)
        try:
            speaker_turns = detect_speakers_by_energy(str(processed_audio_path), num_speakers=2)
        except Exception as e:
            logger.error(f"Diarization failed: {e}. Falling back to single speaker.")
            speaker_turns = [{"speaker": "SPEAKER_00", "start": 0.0, "end": whisper_result["duration"]}]
            
        # STEP 4: Merge transcription with speaker turns
        await update_status(db, recording_id, "merge", user_id=user_id)
        merged_data = merge_whisper_and_diarization(whisper_result["word_timestamps"], speaker_turns)
        
        # STEP 5: Generate summary & action items
        await update_status(db, recording_id, "summary", user_id=user_id)
        summary_result = generate_summary(whisper_result["transcript_raw"])
        
        # STEP 6: Save final results
        logger.info(f"Completing pipeline for {recording_id}")
        recording = await db.recordings.find_one({"_id": ObjectId(recording_id)})
        
        update_data = {
            "status": "completed",
            "step": "done",
            "transcript_raw": whisper_result["transcript_raw"],
            "word_timestamps": whisper_result["word_timestamps"],
            "language": whisper_result["language"],
            "duration": whisper_result["duration"],
            "speakers": merged_data["speakers"],
            "speaker_stats": merged_data["speaker_stats"],
            "summary": summary_result["summary"],
            "action_items": summary_result.get("action_items", []),
            "key_topics": summary_result.get("key_topics", []),
            "sentiment": summary_result.get("sentiment", "neutral"),
            "decisions_made": summary_result.get("decisions_made", []),
            "follow_ups": summary_result.get("follow_ups", []),
            "updated_at": datetime.utcnow()
        }
        
        await db.recordings.update_one({"_id": ObjectId(recording_id)}, {"$set": update_data})
        
        # Index for search
        await db.search_index.update_one(
            {"recording_id": ObjectId(recording_id)},
            {"$set": {
                "user_id": recording["user_id"],
                "team_id": recording.get("team_id"),
                "searchable_text": whisper_result["transcript_raw"],
                "created_at": datetime.utcnow()
            }},
            upsert=True
        )
        
        # Update user stats
        total_time = sum(s["total_time"] for s in merged_data["speaker_stats"].values())
        await db.users.update_one(
            {"_id": ObjectId(recording["user_id"])},
            {
                "$inc": {
                    "recording_count": 1,
                    "total_speaking_time": total_time
                }
            }
        )
        
        logger.info(f"Pipeline COMPLETED for {recording_id}")
        if user_id:
            from app.websocket.notifications import notification_manager
            await notification_manager.send_to_user(str(user_id), {
                "type": "progress",
                "recording_id": str(recording_id),
                "status": "completed",
                "step": "done"
            })        
    except Exception as e:
        logger.error(f"Pipeline failed for {recording_id}: {str(e)}")
        logger.error(traceback.format_exc())
        await update_status(db, recording_id, "failed", status="failed", user_id=str(recording["user_id"]) if 'recording' in locals() and recording else None)
        await db.recordings.update_one(
            {"_id": ObjectId(recording_id)},
            {"$set": {
                "status": "failed", 
                "error_message": str(e),
                "step": "failed",
                "updated_at": datetime.utcnow()
            }}
        )
    finally:
        # Clean up processed audio
        if processed_audio_path and Path(processed_audio_path).exists():
            try:
                Path(processed_audio_path).unlink()
            except Exception:
                pass
