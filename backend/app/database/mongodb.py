from motor.motor_asyncio import AsyncIOMotorClient
from app.config import settings
import logging

logger = logging.getLogger(__name__)

class MongoDB:
    client: AsyncIOMotorClient = None
    db = None

db_config = MongoDB()

async def connect_to_mongo():
    logger.info("Connecting to MongoDB...")
    db_config.client = AsyncIOMotorClient(settings.MONGODB_URL)
    db_config.db = db_config.client[settings.MONGODB_DB_NAME]
    
    # Create indexes
    try:
        await db_config.db.search_index.create_index([("searchable_text", "text")])
        await db_config.db.users.create_index("email", unique=True)
    except Exception as e:
        logger.warning(f"Could not create indexes (might already exist): {e}")

    logger.info("Connected to MongoDB & configured indexes.")

async def close_mongo_connection():
    logger.info("Closing MongoDB connection...")
    if db_config.client:
        db_config.client.close()
    logger.info("MongoDB connection closed.")

def get_db():
    return db_config.db
