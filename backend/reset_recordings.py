import asyncio, sys
sys.path.insert(0, '.')

from motor.motor_asyncio import AsyncIOMotorClient
from app.config import settings

async def main():
    client = AsyncIOMotorClient(settings.MONGODB_URL)
    db = client[settings.MONGODB_DB_NAME]
    
    # Reset all failed recordings to "uploaded" so the pipeline re-runs
    result = await db.recordings.update_many(
        {"status": "failed"},
        {"$set": {"status": "uploaded", "step": "pending", "error_message": None}}
    )
    print(f"Reset {result.modified_count} failed recordings to 'uploaded'")
    
    # List current recordings
    async for rec in db.recordings.find():
        print(f"  ID: {rec['_id']} | Title: {rec.get('title')} | Status: {rec.get('status')}")
    
    client.close()

asyncio.run(main())
