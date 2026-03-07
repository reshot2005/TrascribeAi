from fastapi import APIRouter, Depends, UploadFile, File, Form
from app.database.mongodb import get_db
from app.utils.response_utils import success_response, error_response
from app.middleware.auth_middleware import get_current_user
from bson import ObjectId
from pydantic import BaseModel
from typing import Optional
from app.utils.jwt_utils import get_password_hash
from datetime import datetime
import os, uuid
from app.config import settings

router = APIRouter()

class UpdateUserRequest(BaseModel):
    name: Optional[str] = None
    avatar_url: Optional[str] = None

class AddMemberRequest(BaseModel):
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    department: Optional[str] = None

class CreateDepartmentRequest(BaseModel):
    name: str
    description: Optional[str] = None

class UpdateDepartmentRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None

# ===================== DEPARTMENT ENDPOINTS =====================

@router.post("/departments")
async def create_department(req: CreateDepartmentRequest, current_user=Depends(get_current_user), db=Depends(get_db)):
    """Create a new department (folder) for organizing team members."""
    team_id = current_user.get("team_id")
    if not team_id or current_user.get("role") not in ["admin"]:
        return error_response("Unauthorized or no team")

    existing = await db.departments.find_one({"name": req.name, "team_id": ObjectId(team_id)})
    if existing:
        return error_response("Department with this name already exists")

    now = datetime.utcnow()
    dept_doc = {
        "name": req.name,
        "description": req.description or "",
        "team_id": ObjectId(team_id),
        "created_by": ObjectId(current_user["_id"]),
        "member_count": 0,
        "created_at": now,
        "updated_at": now
    }
    res = await db.departments.insert_one(dept_doc)
    return success_response({
        "_id": str(res.inserted_id),
        "name": req.name,
        "description": req.description or "",
        "team_id": str(team_id),
        "created_by": str(current_user["_id"]),
        "member_count": 0,
        "created_at": now.isoformat(),
        "updated_at": now.isoformat()
    })


@router.get("/departments")
async def get_departments(current_user=Depends(get_current_user), db=Depends(get_db)):
    """Get all departments for the current user's team."""
    team_id = current_user.get("team_id")
    if not team_id:
        return success_response([])

    cursor = db.departments.find({"team_id": ObjectId(team_id)}).sort("name", 1)
    departments = []
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        doc["team_id"] = str(doc["team_id"])
        doc["created_by"] = str(doc["created_by"])
        # Count the members in this department
        count = await db.users.count_documents({"department": doc["_id"], "team_id": ObjectId(team_id)})
        doc["member_count"] = count
        departments.append(doc)
    return success_response(departments)


@router.put("/departments/{dept_id}")
async def update_department(dept_id: str, req: UpdateDepartmentRequest, current_user=Depends(get_current_user), db=Depends(get_db)):
    if current_user.get("role") not in ["admin"]:
        return error_response("Unauthorized")
    
    update_data = {k: v for k, v in req.model_dump().items() if v is not None}
    if update_data:
        update_data["updated_at"] = datetime.utcnow()
        await db.departments.update_one({"_id": ObjectId(dept_id)}, {"$set": update_data})
    return success_response(message="Department updated successfully")


@router.delete("/departments/{dept_id}")
async def delete_department(dept_id: str, current_user=Depends(get_current_user), db=Depends(get_db)):
    if current_user.get("role") not in ["admin"]:
        return error_response("Unauthorized")
    
    # Remove department reference from all users in the department
    await db.users.update_many({"department": dept_id}, {"$set": {"department": None}})
    await db.departments.delete_one({"_id": ObjectId(dept_id)})
    return success_response(message="Department deleted successfully")


# ===================== TEAM MEMBER ENDPOINTS =====================

@router.get("/team")
async def get_team(current_user=Depends(get_current_user), db=Depends(get_db)):
    team_id = current_user.get("team_id")
    if not team_id:
        return success_response([])
        
    cursor = db.users.find({"team_id": ObjectId(team_id)}, {"password_hash": 0})
    members = []
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        doc["team_id"] = str(doc["team_id"])
        members.append(doc)
    return success_response(members)


@router.get("/team/department/{dept_id}")
async def get_department_members(dept_id: str, current_user=Depends(get_current_user), db=Depends(get_db)):
    """Get all team members in a specific department."""
    team_id = current_user.get("team_id")
    if not team_id:
        return success_response([])

    cursor = db.users.find({"team_id": ObjectId(team_id), "department": dept_id}, {"password_hash": 0})
    members = []
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        doc["team_id"] = str(doc["team_id"])
        members.append(doc)
    return success_response(members)


@router.post("/team/member")
async def add_team_member(req: AddMemberRequest, current_user=Depends(get_current_user), db=Depends(get_db)):
    team_id = current_user.get("team_id")
    if not team_id or current_user.get("role") not in ["admin", "hr"]:
        return error_response("Unauthorized or no team")
    
    # If email is provided, check for duplicates
    if req.email:
        existing = await db.users.find_one({"email": req.email})
        if existing:
            return error_response("Email already registered")

    now = datetime.utcnow()
    user_doc = {
        "name": req.name,
        "email": req.email or "",
        "phone": req.phone or "",
        "password_hash": get_password_hash("password123"),  # default password
        "avatar_url": None,
        "role": "member",
        "team_id": ObjectId(team_id),
        "department": req.department,  # department ID string
        "total_speaking_time": 0.0,
        "recording_count": 0,
        "created_at": now,
        "updated_at": now
    }
    
    user_res = await db.users.insert_one(user_doc)
    await db.teams.update_one(
        {"_id": ObjectId(team_id)},
        {"$push": {"members": user_res.inserted_id}}
    )
    
    return success_response({
        "_id": str(user_res.inserted_id),
        "name": req.name,
        "email": req.email or "",
        "phone": req.phone or "",
        "avatar_url": None,
        "role": "member",
        "team_id": str(team_id),
        "department": req.department,
        "total_speaking_time": 0.0,
        "recording_count": 0,
        "created_at": now.isoformat(),
        "updated_at": now.isoformat()
    })


@router.post("/team/member/{user_id}/avatar")
async def upload_member_avatar(user_id: str, file: UploadFile = File(...), current_user=Depends(get_current_user), db=Depends(get_db)):
    """Upload a profile picture for a team member."""
    if current_user.get("role") not in ["admin", "hr"] and str(current_user["_id"]) != user_id:
        return error_response("Unauthorized")

    # Validate file type
    valid_exts = [".jpg", ".jpeg", ".png", ".gif", ".webp"]
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in valid_exts:
        return error_response("Invalid image format. Use jpg, png, gif, or webp.")

    # Save file
    avatar_dir = os.path.join(settings.UPLOAD_DIR, "avatars")
    os.makedirs(avatar_dir, exist_ok=True)
    
    filename = f"{user_id}_{uuid.uuid4().hex[:8]}{ext}"
    filepath = os.path.join(avatar_dir, filename)
    
    with open(filepath, "wb") as f:
        content = await file.read()
        f.write(content)
    
    avatar_url = f"/uploads/avatars/{filename}"
    await db.users.update_one({"_id": ObjectId(user_id)}, {"$set": {"avatar_url": avatar_url, "updated_at": datetime.utcnow()}})
    
    return success_response({"avatar_url": avatar_url})


@router.get("/{user_id}")
async def get_user(user_id: str, current_user=Depends(get_current_user), db=Depends(get_db)):
    user = await db.users.find_one({"_id": ObjectId(user_id)}, {"password_hash": 0})
    if not user:
        return error_response("User not found")
    user["_id"] = str(user["_id"])
    if user.get("team_id"):
        user["team_id"] = str(user["team_id"])
    return success_response(user)

@router.put("/{user_id}")
async def update_user(user_id: str, req: UpdateUserRequest, current_user=Depends(get_current_user), db=Depends(get_db)):
    if str(current_user["_id"]) != user_id and current_user.get("role") not in ["admin", "hr"]:
        return error_response("Unauthorized")
        
    update_data = {k: v for k, v in req.model_dump().items() if v is not None}
    if not update_data:
        return success_response(message="Nothing to update")
        
    await db.users.update_one({"_id": ObjectId(user_id)}, {"$set": update_data})
    return success_response(message="User updated successfully")

@router.delete("/{user_id}")
async def delete_user(user_id: str, current_user=Depends(get_current_user), db=Depends(get_db)):
    if current_user.get("role") not in ["admin", "hr"]:
        return error_response("Unauthorized")
        
    await db.users.delete_one({"_id": ObjectId(user_id)})
    return success_response(message="User deleted successfully")
