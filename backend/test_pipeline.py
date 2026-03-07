import sys, asyncio
sys.path.insert(0, '.')

from app.utils.audio_processing import preprocess_audio
from app.services.whisper_service import transcribe_audio, detect_speakers_by_energy
from app.services.merge_service import merge_whisper_and_diarization
from app.services.summary_service import generate_summary
from pathlib import Path

async def main():
    with open("pipeline_results.txt", "w", encoding="utf-8") as f:
        input_file = Path("./uploads/WhatsApp Audio 2026-03-06 at 3.06.05 PM.mp3")
        
        f.write("=== STEP 1: Preprocessing ===\n")
        wav_path = await preprocess_audio(input_file)
        f.write(f"WAV: {wav_path}\n")
        
        f.write("\n=== STEP 2: Transcription ===\n")
        result = transcribe_audio(str(wav_path))
        f.write(f"Transcript: {result['transcript_raw']}\n")
        f.write(f"Words: {len(result['word_timestamps'])}\n")
        f.write(f"Duration: {result['duration']}s\n")
        
        f.write("\n=== STEP 3: Speaker Detection ===\n")
        speakers = detect_speakers_by_energy(str(wav_path))
        for s in speakers:
            f.write(f"  {s['speaker']}: {s['start']:.1f}s - {s['end']:.1f}s\n")
        f.write(f"  Total turns: {len(speakers)}\n")
        
        f.write("\n=== STEP 4: Merge ===\n")
        merged = merge_whisper_and_diarization(result['word_timestamps'], speakers)
        for seg in merged['speakers']:
            f.write(f"  [{seg['speaker_label']}] {seg['text']}\n")
        
        f.write("\n=== STEP 5: Summary ===\n")
        summary = generate_summary(result['transcript_raw'])
        f.write(f"Summary: {summary['summary']}\n")
        f.write(f"Action items: {summary['action_items']}\n")
        
        # Cleanup
        wav_path.unlink()
        f.write("\n=== PIPELINE COMPLETE ===\n")
    
    print("Results written to pipeline_results.txt")

asyncio.run(main())
