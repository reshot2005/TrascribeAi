import asyncio, sys
sys.path.insert(0, '.')
from motor.motor_asyncio import AsyncIOMotorClient
from app.config import settings

async def main():
    client = AsyncIOMotorClient(settings.MONGODB_URL)
    db = client[settings.MONGODB_DB_NAME]
    async for rec in db.recordings.find():
        print(f"ID: {rec['_id']} | Title: {rec.get('title')} | Status: {rec.get('status')} | File: {rec.get('audio_filename')}")
    client.close()

asyncio.run(main())
