from fastapi import APIRouter, Depends, HTTPException, Body
from app.database.mongodb import get_db
from app.utils.jwt_utils import get_password_hash, verify_password, create_access_token
from app.utils.response_utils import success_response, error_response
from app.middleware.auth_middleware import get_current_user
from datetime import datetime
from bson import ObjectId
from pydantic import BaseModel, EmailStr
from typing import Optional

router = APIRouter()

class RegisterUserRequest(BaseModel):
    name: str
    email: EmailStr
    password: str
    team_name: Optional[str] = None

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

@router.post("/register")
async def register(req: RegisterUserRequest, db=Depends(get_db)):
    existing = await db.users.find_one({"email": req.email})
    if existing:
        return error_response("Email already registered")
        
    team_id = None
    if req.team_name:
        team_doc = {
            "name": req.team_name,
            "owner_id": None,  # Will update after user creation
            "members": [],
            "created_at": datetime.utcnow()
        }
        team_res = await db.teams.insert_one(team_doc)
        team_id = team_res.inserted_id
        
    user_doc = {
        "name": req.name,
        "email": req.email,
        "password_hash": get_password_hash(req.password),
        "avatar_url": None,
        "role": "admin" if req.team_name else "member",
        "team_id": team_id,
        "total_speaking_time": 0.0,
        "recording_count": 0,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    user_res = await db.users.insert_one(user_doc)
    
    if team_id:
        await db.teams.update_one(
            {"_id": team_id}, 
            {"$set": {"owner_id": user_res.inserted_id}, "$push": {"members": user_res.inserted_id}}
        )
        
    token = create_access_token({"sub": str(user_res.inserted_id), "email": req.email})
    return success_response({"token": token, "user_id": str(user_res.inserted_id)})

@router.post("/login")
async def login(req: LoginRequest, db=Depends(get_db)):
    user = await db.users.find_one({"email": req.email})
    if not user or not verify_password(req.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
        
    token = create_access_token({"sub": str(user["_id"]), "email": req.email, "role": user.get("role")})
    user["_id"] = str(user["_id"])
    if user.get("team_id"):
        user["team_id"] = str(user["team_id"])
    user.pop("password_hash")
    
    return success_response({"token": token, "user": user})

@router.get("/me")
async def get_me(current_user=Depends(get_current_user)):
    current_user["_id"] = str(current_user["_id"])
    if current_user.get("team_id"):
        current_user["team_id"] = str(current_user["team_id"])
    current_user.pop("password_hash", None)
    return success_response(current_user)
