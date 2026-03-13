import sys
import os
import logging

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from app.services.whisper_service import transcribe_audio
from app.utils.audio_processing import preprocess_audio
import asyncio

logging.basicConfig(level=logging.INFO)

async def test_transcription():
    file_path = r"c:\Users\surya\OneDrive\Desktop\PROJECTS\AI TRASCRIBE\Jeff\AIMS.m4a.mp4"
    if not os.path.exists(file_path):
        print(f"File not found: {file_path}")
        return

    print(f"Testing NEW Faster-Whisper transcription for {file_path}...")
    
    # Preprocess
    print("Preprocessing...")
    processed_path = await preprocess_audio(file_path)
    print(f"Processed path: {processed_path}")
    
    # Transcribe
    print("Transcribing with NEW service (Faster-Whisper)...")
    # This will load the model (approx 150MB for 'base')
    result = transcribe_audio(processed_path)
    
    print("\n--- NEW TRANSCRIPT ---")
    print(result['transcript_raw'][:1000] + "...")
    print(f"\nTotal characters: {len(result['transcript_raw'])}")
    print(f"Duration: {result['duration']}s")
    print(f"Detected Language: {result['language']}")
    
    # Clean up
    if os.path.exists(processed_path):
        os.remove(processed_path)

if __name__ == "__main__":
    asyncio.run(test_transcription())
