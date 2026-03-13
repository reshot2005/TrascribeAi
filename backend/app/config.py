from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List

class Settings(BaseSettings):
    APP_NAME: str = "TeamVoice AI"
    DEBUG: bool = True
    SECRET_KEY: str = "your-super-secret-jwt-key-change-this"
    
    MONGODB_URL: str = "mongodb://localhost:27017" # default for dev
    MONGODB_DB_NAME: str = "teamvoice"
    
    HUGGINGFACE_TOKEN: str = ""
    
    STORAGE_TYPE: str = "local"
    CLOUDINARY_CLOUD_NAME: str = ""
    CLOUDINARY_API_KEY: str = ""
    CLOUDINARY_API_SECRET: str = ""
    UPLOAD_DIR: str = "./uploads"
    
    OPENAI_API_KEY: str = ""
    OLLAMA_URL: str = ""
    
    REDIS_URL: str = "redis://localhost:6379"
    
    ALLOWED_ORIGINS: str = "http://localhost:3000,http://localhost:5173,https://trascribe-ai.vercel.app"

    # AI Model Settings
    WHISPER_MODEL: str = "base" # tiny, base, small, medium, large-v3
    DIARIZATION_MODEL: str = "pyannote/speaker-diarization-3.1"


    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")
    
    @property
    def allowed_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",")]

settings = Settings()
