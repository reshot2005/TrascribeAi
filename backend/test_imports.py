import sys
sys.path.insert(0, '.')

try:
    from app.services.whisper_service import transcribe_audio, detect_speakers_by_energy
    print("whisper_service: OK")
except Exception as e:
    print(f"whisper_service: FAIL - {e}")

try:
    from app.utils.audio_processing import preprocess_audio
    print("audio_processing: OK")
except Exception as e:
    print(f"audio_processing: FAIL - {e}")

try:
    from app.services.transcription_pipeline import run_pipeline
    print("transcription_pipeline: OK")
except Exception as e:
    print(f"transcription_pipeline: FAIL - {e}")

try:
    from app.main import app
    print("main app: OK")
except Exception as e:
    print(f"main app: FAIL - {e}")
