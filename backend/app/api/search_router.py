from fastapi import APIRouter, Depends
from app.database.mongodb import get_db
from app.utils.response_utils import success_response, error_response
from app.middleware.auth_middleware import get_current_user
from bson import ObjectId

router = APIRouter()

@router.get("/")
async def search_transcripts(q: str, team_id: str = None, user_id: str = None, current_user=Depends(get_current_user), db=Depends(get_db)):
    query = {"$text": {"$search": q}}
    
    if team_id: query["team_id"] = ObjectId(team_id)
    if user_id: query["user_id"] = ObjectId(user_id)
    
    results = []
    cursor = db.search_index.find(
        query,
        {"score": {"$meta": "textScore"}}
    ).sort([("score", {"$meta": "textScore"})]).limit(20)
    
    async for doc in cursor:
        recording = await db.recordings.find_one({"_id": doc["recording_id"]})
        if not recording: continue
        
        # Find matched segments roughly
        matched_segments = []
        for spk in recording.get("speakers", []):
            if q.lower() in spk["text"].lower():
                matched_segments.append({
                    "text": spk["text"],
                    "start": spk["start"],
                    "end": spk["end"]
                })
                
        results.append({
            "recording_id": str(recording["_id"]),
            "title": recording["title"],
            "matched_segments": matched_segments
        })
        
    return success_response(results)
