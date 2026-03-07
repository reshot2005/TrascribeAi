import asyncio
from typing import Optional
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorClient
from app.config import settings
from app.utils.jwt_utils import get_password_hash
from bson import ObjectId

async def seed_users():
    print("Connecting to MongoDB to seed Admin & HR...")
    client = AsyncIOMotorClient(settings.MONGODB_URL)
    db = client[settings.MONGODB_DB_NAME]
    
    # Pre-checks
    admin_exists = await db.users.find_one({"email": "admin@teamvoice.ai"})
    if admin_exists:
        print("Admin user already seeded!")
        return

    # Create Team
    team_doc = {
        "name": "TeamVoice Headquarters",
        "owner_id": None, 
        "members": [],
        "created_at": datetime.utcnow()
    }
    team_res = await db.teams.insert_one(team_doc)
    team_id = team_res.inserted_id

    # Create Admin
    admin_doc = {
        "name": "Admin Director",
        "email": "admin@teamvoice.ai",
        "password_hash": get_password_hash("AdminPass123!"),
        "role": "admin",
        "team_id": team_id,
        "avatar_url": "https://i.pravatar.cc/150?img=12",
        "total_speaking_time": 0.0,
        "recording_count": 0,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    admin_res = await db.users.insert_one(admin_doc)

    # Create HR
    hr_doc = {
        "name": "HR Manager",
        "email": "hr@teamvoice.ai",
        "password_hash": get_password_hash("HrPass123!"),
        "role": "hr",
        "team_id": team_id,
        "avatar_url": "https://i.pravatar.cc/150?img=5",
        "total_speaking_time": 0.0,
        "recording_count": 0,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    hr_res = await db.users.insert_one(hr_doc)

    # Update Team Owners & Members
    await db.teams.update_one(
        {"_id": team_id}, 
        {
            "$set": {"owner_id": admin_res.inserted_id},
            "$push": {"members": {"$each": [admin_res.inserted_id, hr_res.inserted_id]}}
        }
    )

    print("Seed process successfully completed!")
    print("-------------------------------------")
    print("ADMIN -> Email: admin@teamvoice.ai | Pass: AdminPass123!")
    print("HR    -> Email: hr@teamvoice.ai    | Pass: HrPass123!")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(seed_users())
