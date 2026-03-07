from fastapi import APIRouter, Depends
from app.database.mongodb import get_db
from app.utils.response_utils import success_response, error_response
from app.middleware.auth_middleware import get_current_user
from bson import ObjectId

router = APIRouter()

@router.get("/team/{team_id}")
async def get_team_analytics(team_id: str, current_user=Depends(get_current_user), db=Depends(get_db)):
    if current_user.get("team_id") != team_id and current_user.get("role") != "admin":
        return error_response("Unauthorized")
        
    pipeline = [
        {"$match": {"team_id": ObjectId(team_id), "status": "completed"}},
        {"$group": {
            "_id": None,
            "total_recordings": {"$sum": 1},
            "total_hours": {"$sum": {"$divide": ["$duration", 3600]}}
        }}
    ]
    
    res = await db.recordings.aggregate(pipeline).to_list(1)
    stats = res[0] if res else {"total_recordings": 0, "total_hours": 0.0}
    
    return success_response(stats)

@router.get("/user/{user_id}")
async def get_user_analytics(user_id: str, current_user=Depends(get_current_user), db=Depends(get_db)):
    if str(current_user["_id"]) != user_id and current_user.get("role") != "admin":
        return error_response("Unauthorized")
        
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user: return error_response("User not found")
        
    return success_response({
        "total_recordings": user.get("recording_count", 0),
        "total_speaking_time": user.get("total_speaking_time", 0.0)
    })
