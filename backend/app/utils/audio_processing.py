import os
import uuid
import logging
import subprocess
from pathlib import Path
from app.config import settings

logger = logging.getLogger(__name__)

def get_ffmpeg_path():
    """Get ffmpeg binary - try system first, then imageio-ffmpeg bundled binary."""
    # Check if ffmpeg is on PATH  
    import shutil
    system_ffmpeg = shutil.which("ffmpeg")
    if system_ffmpeg:
        return system_ffmpeg
    
    # Fallback: use imageio-ffmpeg bundled binary
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except ImportError:
        raise RuntimeError("No ffmpeg found. Install ffmpeg or pip install imageio-ffmpeg")

async def preprocess_audio(input_path) -> Path:
    """Convert any audio to 16kHz mono WAV for transcription."""
    input_path = Path(input_path)
    logger.info(f"Preprocessing audio: {input_path}")
    
    output_filename = f"{uuid.uuid4().hex}_processed.wav"
    output_dir = Path(settings.UPLOAD_DIR) / "processed"
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / output_filename
    
    ffmpeg_bin = get_ffmpeg_path()
    
    try:
        cmd = [
            ffmpeg_bin, "-y", "-i", str(input_path),
            "-acodec", "pcm_s16le",
            "-ac", "1",
            "-ar", "16000",
            str(output_path)
        ]
        
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=120
        )
        
        if result.returncode != 0:
            logger.error(f"FFmpeg stderr: {result.stderr}")
            raise Exception(f"FFmpeg failed: {result.stderr[:500]}")
        
        logger.info(f"Preprocessed audio saved to {output_path}")
        return output_path
        
    except subprocess.TimeoutExpired:
        raise Exception("Audio preprocessing timed out (>120s)")
    except FileNotFoundError:
        raise Exception("ffmpeg binary not found")
