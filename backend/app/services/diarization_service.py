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
            try:
                import torch
                device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
                
                cls._instance = Pipeline.from_pretrained(
                    "pyannote/speaker-diarization-3.1",
                    token=token
                ).to(device)
                logger.info(f"Diarization pipeline loaded on {device}.")
            except Exception as e:
                logger.error(f"Failed to load pyannote pipeline: {e}")
                logger.error("Make sure you have accepted the terms at https://huggingface.co/pyannote/speaker-diarization-3.1")
                cls._instance = "FAILED" 
        return cls._instance if cls._instance != "FAILED" else None

def diarize_audio(audio_path: str):
    logger.info(f"Starting diarization for {audio_path}")
    pipeline = DiarizationSingleton.get_pipeline()
    
    if not pipeline:
        logger.warning("Diarization pipeline not available. Using single speaker fallback.")
        from app.services.whisper_service import get_wav_duration
        duration = get_wav_duration(audio_path)
        return [{"speaker": "SPEAKER_00", "start": 0.0, "end": duration or 60.0}]
    
    diarization = pipeline(audio_path)
    
    speaker_turns = []
    for turn, _, speaker in diarization.itertracks(yield_label=True):
        speaker_turns.append({
            "speaker": speaker,
            "start": turn.start,
            "end": turn.end
        })
        
    return speaker_turns
