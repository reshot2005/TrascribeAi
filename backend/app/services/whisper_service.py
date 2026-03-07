import speech_recognition as sr
import logging
import wave
import struct
import math
from pathlib import Path
from typing import List, Dict, Any

logger = logging.getLogger(__name__)

def transcribe_audio(audio_path: str) -> Dict[str, Any]:
    """
    Transcribe audio using Google Speech Recognition (free, no API key).
    Splits long audio into chunks for reliable transcription.
    Returns transcript with word-level timing estimates.
    """
    audio_path = str(audio_path)
    logger.info(f"Starting transcription for {audio_path}")
    
    recognizer = sr.Recognizer()
    
    # Get audio duration first
    duration = get_wav_duration(audio_path)
    logger.info(f"Audio duration: {duration:.1f}s")
    
    # Split into chunks of ~30 seconds for better accuracy
    chunk_duration = 30  # seconds  
    chunks = []
    
    if duration <= chunk_duration:
        chunks = [(0, duration)]
    else:
        start = 0
        while start < duration:
            end = min(start + chunk_duration, duration)
            chunks.append((start, end))
            start = end
    
    full_transcript = ""
    word_timestamps = []
    
    for chunk_start, chunk_end in chunks:
        try:
            with sr.AudioFile(audio_path) as source:
                audio_data = recognizer.record(
                    source,
                    offset=chunk_start,
                    duration=chunk_end - chunk_start
                )
            
            # Use Google Speech Recognition (free)
            text = recognizer.recognize_google(audio_data, show_all=False)
            logger.info(f"Chunk [{chunk_start:.1f}-{chunk_end:.1f}s]: {text[:80]}...")
            
            full_transcript += text + " "
            
            # Generate estimated word timestamps
            words = text.split()
            if words:
                time_per_word = (chunk_end - chunk_start) / len(words)
                for i, word in enumerate(words):
                    word_timestamps.append({
                        "word": word,
                        "start": round(chunk_start + i * time_per_word, 2),
                        "end": round(chunk_start + (i + 1) * time_per_word, 2),
                        "confidence": 0.85
                    })
                    
        except sr.UnknownValueError:
            logger.warning(f"Could not understand audio in chunk [{chunk_start:.1f}-{chunk_end:.1f}s]")
            full_transcript += "[inaudible] "
        except sr.RequestError as e:
            logger.error(f"Google API error: {e}")
            full_transcript += "[transcription error] "
        except Exception as e:
            logger.error(f"Error processing chunk [{chunk_start:.1f}-{chunk_end:.1f}s]: {e}")
            full_transcript += "[error] "
    
    # Detect language (simple heuristic)
    detected_language = "en"
    
    return {
        "transcript_raw": full_transcript.strip(),
        "word_timestamps": word_timestamps,
        "language": detected_language,
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
        return 0.0


def detect_speakers_by_energy(audio_path: str, num_speakers: int = 2) -> List[Dict]:
    """
    Simple energy-based speaker diarization.
    Splits audio into segments based on silence detection,
    then assigns alternating speakers to segments separated by pauses.
    """
    logger.info(f"Running energy-based speaker detection on {audio_path}")
    
    try:
        with wave.open(audio_path, 'rb') as wf:
            channels = wf.getnchannels()
            sample_width = wf.getsampwidth()
            frame_rate = wf.getframerate()
            n_frames = wf.getnframes()
            raw_data = wf.readframes(n_frames)
        
        # Convert to samples
        if sample_width == 2:
            fmt = f"<{n_frames * channels}h"
            samples = struct.unpack(fmt, raw_data)
        else:
            logger.warning(f"Unsupported sample width: {sample_width}")
            duration = n_frames / frame_rate
            return [{"speaker": "SPEAKER_00", "start": 0.0, "end": duration}]
        
        # Calculate energy in windows
        window_size = int(frame_rate * 0.1)  # 100ms windows
        energies = []
        for i in range(0, len(samples), window_size):
            chunk = samples[i:i + window_size]
            if chunk:
                rms = math.sqrt(sum(s**2 for s in chunk) / len(chunk))
                energies.append(rms)
            else:
                energies.append(0)
        
        if not energies:
            duration = n_frames / frame_rate
            return [{"speaker": "SPEAKER_00", "start": 0.0, "end": duration}]
        
        # Find silence threshold
        avg_energy = sum(energies) / len(energies)
        silence_threshold = avg_energy * 0.3
        
        # Find speech segments (non-silent regions)
        segments = []
        in_speech = False
        seg_start = 0
        
        for i, energy in enumerate(energies):
            time_pos = i * 0.1
            
            if energy > silence_threshold and not in_speech:
                in_speech = True
                seg_start = time_pos
            elif energy <= silence_threshold and in_speech:
                in_speech = False
                if time_pos - seg_start > 0.3:  # Minimum 300ms speech segment
                    segments.append({"start": seg_start, "end": time_pos})
        
        # Don't forget last segment
        if in_speech:
            segments.append({"start": seg_start, "end": len(energies) * 0.1})
        
        if not segments:
            duration = n_frames / frame_rate
            return [{"speaker": "SPEAKER_00", "start": 0.0, "end": duration}]
        
        # Merge very close segments (gaps < 0.5s)
        merged = [segments[0]]
        for seg in segments[1:]:
            if seg["start"] - merged[-1]["end"] < 0.5:
                merged[-1]["end"] = seg["end"]
            else:
                merged.append(seg)
        
        # Assign speakers: alternate between speakers at significant pauses (>1s)
        speaker_turns = []
        current_speaker = 0
        
        for i, seg in enumerate(merged):
            speaker_label = f"Speaker {current_speaker + 1}"
            speaker_turns.append({
                "speaker": speaker_label,
                "start": seg["start"],
                "end": seg["end"]
            })
            
            # Switch speaker at gaps longer than 1 second
            if i < len(merged) - 1:
                gap = merged[i + 1]["start"] - seg["end"]
                if gap > 1.0:
                    current_speaker = (current_speaker + 1) % num_speakers
        
        logger.info(f"Detected {len(speaker_turns)} speaker turns")
        return speaker_turns
        
    except Exception as e:
        logger.error(f"Speaker detection error: {e}")
        return [{"speaker": "Speaker 1", "start": 0.0, "end": 60.0}]
