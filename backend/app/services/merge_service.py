import logging
from typing import List, Dict

logger = logging.getLogger(__name__)

def merge_whisper_and_diarization(word_timestamps: List[Dict], speaker_turns: List[Dict]) -> Dict:
    logger.info("Merging whisper words with diarization turns...")
    
    speakers_data = []
    speaker_stats = {}
    
    current_speaker = None
    current_segment = None
    
    for word in word_timestamps:
        word_mid = (word["start"] + word["end"]) / 2
        
        # Find matching speaker
        matched_speaker = current_speaker or "Speaker 1"
        for turn in speaker_turns:
            if turn["start"] - 0.5 <= word_mid <= turn["end"] + 0.5:
                matched_speaker = turn["speaker"]
                break
                
        # Group words by speaker
        if matched_speaker != current_speaker:
            if current_segment:
                speakers_data.append(current_segment)
                
            current_speaker = matched_speaker
            current_segment = {
                "speaker_label": current_speaker,
                "speaker_name": None,
                "text": word["word"],
                "words": [word],
                "start": word["start"],
                "end": word["end"],
                "confidence": word["confidence"],
                "word_count": 1
            }
        else:
            current_segment["text"] += " " + word["word"]
            current_segment["words"].append(word)
            current_segment["end"] = word["end"]
            current_segment["word_count"] += 1
            # running average confidence
            current_segment["confidence"] = (current_segment["confidence"] + word["confidence"]) / 2
            
    if current_segment:
        speakers_data.append(current_segment)
        
    # Calculate stats
    for seg in speakers_data:
        lbl = seg["speaker_label"]
        if lbl not in speaker_stats:
            speaker_stats[lbl] = {"total_time": 0.0, "word_count": 0, "turn_count": 0}
            
        speaker_stats[lbl]["total_time"] += (seg["end"] - seg["start"])
        speaker_stats[lbl]["word_count"] += seg["word_count"]
        speaker_stats[lbl]["turn_count"] += 1

    return {
        "speakers": speakers_data,
        "speaker_stats": speaker_stats
    }
