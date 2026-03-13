import logging
import wave
import torch
from pathlib import Path
from typing import List, Dict, Any
from faster_whisper import WhisperModel
from app.config import settings

logger = logging.getLogger(__name__)

class WhisperSingleton:
    _instance = None
    
    @classmethod
    def get_model(cls):
        if cls._instance is None:
            model_size = settings.WHISPER_MODEL
            logger.info(f"Loading Whisper model: {model_size}...")
            
            # Determine device & compute type
            if torch.cuda.is_available():
                device = "cuda"
                compute_type = "float16"
                logger.info("Using CUDA for Whisper.")
            else:
                device = "cpu"
                compute_type = "int8" # Fastest for CPU
                logger.info("Using CPU for Whisper (int8 quantization).")
            
            cls._instance = WhisperModel(model_size, device=device, compute_type=compute_type)
            logger.info(f"Whisper model {model_size} loaded.")
        return cls._instance

def transcribe_audio(audio_path: str) -> Dict[str, Any]:
    """
    Transcribe audio using faster-whisper.
    Returns transcript with word-level timing.
    """
    audio_path = str(audio_path)
    logger.info(f"Starting faster-whisper transcription for {audio_path}")
    
    model = WhisperSingleton.get_model()
    
    # Transcribe with word-level timestamps
    # beam_size=5 for better accuracy, vad_filter=True to ignore silence/background noise
    segments, info = model.transcribe(
        audio_path, 
        beam_size=5, 
        word_timestamps=True,
        vad_filter=True,
        vad_parameters=dict(min_silence_duration_ms=500)
    )
    
    logger.info(f"Detected language '{info.language}' with probability {info.language_probability:.2f}")
    
    full_transcript = []
    word_timestamps = []
    
    for segment in segments:
        full_transcript.append(segment.text)
        if segment.words:
            for word in segment.words:
                word_timestamps.append({
                    "word": word.word.strip(),
                    "start": round(word.start, 2),
                    "end": round(word.end, 2),
                    "confidence": round(word.probability, 2)
                })
    
    transcript_raw = " ".join(full_transcript).strip()
    
    # Get total duration
    duration = get_wav_duration(audio_path)
    
    return {
        "transcript_raw": transcript_raw,
        "word_timestamps": word_timestamps,
        "language": info.language,
        "duration": duration
    }

def get_wav_duration(wav_path: str) -> float:
    """Get duration of a WAV file."""
    try:
        with wave.open(wav_path, 'rb') as wf:
            frames = wf.getnframes()
            rate = wf.getframerate()
            return frames / float(rate)
    except Exception as e:
        logger.error(f"Error reading WAV duration: {e}")
        # Fallback if wave.open fails (might not be a simple wav)
        return 0.0

def detect_speakers_by_energy(audio_path: str, num_speakers: int = 2) -> List[Dict]:
    """
    Legacy energy-based speaker diarization.
    Kept for backward compatibility, but diarization_service should be preferred.
    """
    logger.warning("Using legacy energy-based diarization. Consider switching to diarization_service.diarize_audio.")
    # Return a single speaker if something goes wrong or to avoid complex re-implementation
    duration = get_wav_duration(audio_path)
    return [{"speaker": "SPEAKER_00", "start": 0.0, "end": duration or 60.0}]

