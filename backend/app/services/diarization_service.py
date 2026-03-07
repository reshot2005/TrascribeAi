from pyannote.audio import Pipeline
from app.config import settings
import logging

logger = logging.getLogger(__name__)

class DiarizationSingleton:
    _instance = None
    
    @classmethod
    def get_pipeline(cls):
        if cls._instance is None:
            logger.info("Loading pyannote diarization pipeline...")
            token = settings.HUGGINGFACE_TOKEN
            if not token:
                logger.warning("No HUGGINGFACE_TOKEN provided. Diarization will likely fail.")
            cls._instance = Pipeline.from_pretrained(
                "pyannote/speaker-diarization-3.1",
                use_auth_token=token
            )
            logger.info("Diarization pipeline loaded.")
        return cls._instance

def diarize_audio(audio_path: str):
    logger.info(f"Starting diarization for {audio_path}")
    pipeline = DiarizationSingleton.get_pipeline()
    
    diarization = pipeline(audio_path)
    
    speaker_turns = []
    for turn, _, speaker in diarization.itertracks(yield_label=True):
        speaker_turns.append({
            "speaker": speaker,
            "start": turn.start,
            "end": turn.end
        })
        
    return speaker_turns
