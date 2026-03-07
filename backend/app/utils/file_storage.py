import os
import aiofiles
import logging
from pathlib import Path
from app.config import settings
from fastapi import UploadFile
import cloudinary
import cloudinary.uploader

logger = logging.getLogger(__name__)

if settings.STORAGE_TYPE == "cloudinary":
    cloudinary.config(
        cloud_name=settings.CLOUDINARY_CLOUD_NAME,
        api_key=settings.CLOUDINARY_API_KEY,
        api_secret=settings.CLOUDINARY_API_SECRET
    )

async def save_upload_file(upload_file: UploadFile) -> Path:
    logger.info(f"Saving uploaded file: {upload_file.filename}")
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    file_path = Path(settings.UPLOAD_DIR) / upload_file.filename
    
    async with aiofiles.open(file_path, 'wb') as out_file:
        while content := await upload_file.read(1024 * 1024):  # async read chunk
            await out_file.write(content)
            
    return file_path

async def delete_file(file_path: Path):
    if file_path.exists():
        os.remove(file_path)
