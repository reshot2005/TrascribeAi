import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from app.config import settings
from app.utils.jwt_utils import verify_password

async def test():
    client = AsyncIOMotorClient(settings.MONGODB_URL)
    db = client[settings.MONGODB_DB_NAME]
    user = await db.users.find_one({"email": "admin@teamvoice.ai"})
    if not user:
        print("User not found")
        return
    valid = verify_password("AdminPass123!", user["password_hash"])
    print(f"Valid: {valid}")

asyncio.run(test())
