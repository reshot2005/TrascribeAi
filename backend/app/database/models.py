from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List, Dict
from datetime import datetime
from bson import ObjectId

class PyObjectId(ObjectId):
    @classmethod
    def __get_validators__(cls):
        yield cls.validate

    @classmethod
    def validate(cls, v, handler=None):
        if not ObjectId.is_valid(v):
            raise ValueError("Invalid ObjectId")
        return ObjectId(v)

    @classmethod
    def __get_pydantic_json_schema__(cls, core_schema, handler):
        return {"type": "string"}

# DB Models (Pydantic models for serialization)

class UserModelResponse(BaseModel):
    id: str = Field(alias="_id")
    name: str
    email: EmailStr
    avatar_url: Optional[str] = None
    role: str
    team_id: str
    total_speaking_time: float
    recording_count: int
    created_at: datetime
    updated_at: datetime

class TeamModelResponse(BaseModel):
    id: str = Field(alias="_id")
    name: str
    owner_id: str
    members: List[str]
    created_at: datetime

class SpeakerStats(BaseModel):
    total_time: float
    word_count: int
    turn_count: int

class SpeakerSegment(BaseModel):
    speaker_label: str
    speaker_name: Optional[str] = None
    text: str
    start: float
    end: float
    confidence: float

class WordTimestamp(BaseModel):
    word: str
    start: float
    end: float
    confidence: float

class RecordingModelResponse(BaseModel):
    id: str = Field(alias="_id")
    user_id: str
    team_id: str
    title: str
    audio_url: str
    audio_filename: str
    duration: float
    file_size: int
    status: str
    transcript_raw: str
    speakers: List[SpeakerSegment]
    word_timestamps: List[WordTimestamp]
    summary: Optional[str] = None
    action_items: List[str]
    speaker_stats: Dict[str, SpeakerStats]
    language: str
    created_at: datetime
    updated_at: datetime
