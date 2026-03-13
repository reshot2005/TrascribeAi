import sys
import asyncio
import os
import logging
from pathlib import Path
from datetime import datetime

# Add current directory (backend) to sys.path
sys.path.insert(0, os.getcwd())

from app.utils.audio_processing import preprocess_audio
from app.services.whisper_service import transcribe_audio
from app.services.diarization_service import diarize_audio
from app.services.merge_service import merge_whisper_and_diarization
from app.services.summary_service import generate_summary
from app.config import settings

# Configure logging to both console and file
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler("advanced_pipeline_test.log", encoding="utf-8")
    ]
)
logger = logging.getLogger("advanced_test")

async def test_full_pipeline():
    # Use one of the user's files for testing
    input_file = Path(r"C:\Users\surya\OneDrive\Desktop\PROJECTS\AI TRASCRIBE\jeff\CMR University 19-02.m4a.mp4")
    
    if not input_file.exists():
        logger.error(f"Input file not found: {input_file}")
        return

    logger.info(f"--- STARTING ADVANCED PIPELINE TEST FOR: {input_file.name} ---")
    start_time = datetime.now()
    
    try:
        # STEP 1: Preprocessing
        logger.info("[STEP 1/5] Preprocessing audio to 16kHz mono WAV...")
        wav_path = await preprocess_audio(input_file)
        logger.info(f"   Done. Saved to: {wav_path}")
        
        # STEP 2: Transcription (Faster-Whisper)
        logger.info("[STEP 2/5] Transcribing with Faster-Whisper (base model)...")
        whisper_start = datetime.now()
        whisper_result = transcribe_audio(str(wav_path))
        whisper_end = datetime.now()
        logger.info(f"   Done in {(whisper_end - whisper_start).total_seconds():.1f}s")
        logger.info(f"   Transcript length: {len(whisper_result['transcript_raw'])} chars")
        logger.info(f"   Language: {whisper_result['language']}")
        
        # STEP 3: Diarization (Pyannote)
        logger.info("[STEP 3/5] Diarizing with Pyannote (Deep Speaker ID)...")
        diarize_start = datetime.now()
        speaker_turns = diarize_audio(str(wav_path))
        diarize_end = datetime.now()
        logger.info(f"   Done in {(diarize_end - diarize_start).total_seconds():.1f}s")
        logger.info(f"   Detected {len(speaker_turns)} speaker segments")
        
        # STEP 4: Merging
        logger.info("[STEP 4/5] Merging Whisper word timestamps with speaker turns...")
        merged_data = merge_whisper_and_diarization(whisper_result["word_timestamps"], speaker_turns)
        logger.info(f"   Done. Merged into {len(merged_data['speakers'])} dialogue turns.")
        
        # STEP 5: Summarization
        logger.info("[STEP 5/5] Generating summary and action items...")
        summary_start = datetime.now()
        summary_result = generate_summary(whisper_result["transcript_raw"])
        summary_end = datetime.now()
        logger.info(f"   Done in {(summary_end - summary_start).total_seconds():.1f}s")
        
        # FINAL REPORT
        total_duration = (datetime.now() - start_time).total_seconds()
        logger.info("--- TEST SUMMARY ---")
        logger.info(f"Total processing time: {total_duration:.1f}s")
        logger.info(f"Audio length: {whisper_result['duration']:.1f}s")
        logger.info(f"Processing ratio: {total_duration / whisper_result['duration']:.2f}x (lower is faster)")
        
        # Log a snippet of the diarized transcript
        logger.info("\n--- DIALOGUE SNIPPET (First 5 turns) ---")
        for i, turn in enumerate(merged_data['speakers'][:5]):
            logger.info(f"[{turn['speaker_label']}] {turn['text'][:100]}...")
            
        logger.info("\n--- SUMMARY SNIPPET ---")
        logger.info(summary_result['summary'][:300] + "...")
        
        # Cleanup
        if wav_path.exists():
            wav_path.unlink()
            logger.info("Temporary WAV file cleaned up.")
            
    except Exception as e:
        logger.exception(f"Pipeline test FAILED: {str(e)}")
    
    logger.info("--- TEST COMPLETE ---")

if __name__ == "__main__":
    # Check for HuggingFace Token
    if not settings.HUGGINGFACE_TOKEN:
        print("WARNING: HUGGINGFACE_TOKEN is missing in .env! Diarization WILL fail.")
    
    asyncio.run(test_full_pipeline())
