"""
AI-Powered Summary Service using Groq API (llama-3.3-70b-versatile)
Falls back to extractive summarization if AI is unavailable.
"""
import logging
import re
import requests
from typing import Dict, Any, Optional
from app.config import settings

logger = logging.getLogger(__name__)

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = "llama-3.3-70b-versatile"


def _call_groq(system_prompt: str, user_prompt: str, max_tokens: int = 2000, temperature: float = 0.3) -> Optional[str]:
    """Make a call to the Groq API. Returns None on failure."""
    api_key = settings.OPENAI_API_KEY
    if not api_key or not api_key.startswith("gsk_"):
        return None
    
    try:
        response = requests.post(
            GROQ_API_URL,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            },
            json={
                "model": GROQ_MODEL,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                "max_tokens": max_tokens,
                "temperature": temperature,
                "stream": False
            },
            timeout=60
        )
        
        if response.status_code == 200:
            return response.json()["choices"][0]["message"]["content"].strip()
        else:
            logger.error(f"Groq API error {response.status_code}: {response.text[:200]}")
            return None
    except Exception as e:
        logger.error(f"Groq API call failed: {e}")
        return None


def _extract_json_from_response(text: str) -> Dict[str, Any]:
    """Extract JSON from AI response, handling markdown code blocks."""
    import json
    
    # Try to find JSON in code blocks
    json_match = re.search(r'```(?:json)?\s*\n?(.*?)\n?```', text, re.DOTALL)
    if json_match:
        text = json_match.group(1).strip()
    
    # Try direct JSON parse
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    
    # Try to find JSON object in text
    brace_match = re.search(r'\{.*\}', text, re.DOTALL)
    if brace_match:
        try:
            return json.loads(brace_match.group())
        except json.JSONDecodeError:
            pass
    
    return {}


def generate_summary(transcript_raw: str) -> Dict[str, Any]:
    """
    Generate an AI-powered summary with action items from transcript text.
    Uses Groq's llama-3.3-70b-versatile for high-quality analysis.
    Falls back to extractive method if AI is unavailable.
    """
    if not transcript_raw or len(transcript_raw.strip()) < 20:
        return {
            "summary": transcript_raw or "",
            "action_items": [],
            "key_topics": [],
            "sentiment": "neutral"
        }
    
    # Try AI-powered summary first
    ai_result = _generate_ai_summary(transcript_raw)
    if ai_result:
        logger.info("AI-powered summary generated successfully via Groq")
        return ai_result
    
    # Fallback to extractive method
    logger.info("Falling back to extractive summary (AI unavailable)")
    return _generate_extractive_summary(transcript_raw)


def _generate_ai_summary(transcript_raw: str) -> Optional[Dict[str, Any]]:
    """Generate summary using Groq AI."""
    
    # Truncate very long transcripts to stay within token limits
    max_chars = 15000
    transcript_text = transcript_raw[:max_chars]
    if len(transcript_raw) > max_chars:
        transcript_text += "\n... [transcript truncated]"
    
    system_prompt = """You are an expert meeting analyst AI. Analyze the provided transcript and generate a comprehensive but concise analysis.

Return your response as a valid JSON object with exactly these keys:
{
    "summary": "A clear, professional 3-5 sentence summary of the key discussion points and outcomes",
    "action_items": ["Action item 1 with owner and deadline if mentioned", "Action item 2..."],
    "key_topics": ["Topic 1", "Topic 2", "Topic 3"],
    "sentiment": "positive/negative/neutral/mixed",
    "decisions_made": ["Decision 1", "Decision 2"],
    "follow_ups": ["Follow-up needed 1", "Follow-up needed 2"]
}

Rules:
- Summary should capture the essence of the discussion
- Action items should be specific and actionable, include who is responsible if mentioned
- Key topics should be 3-5 most important themes discussed
- Sentiment reflects the overall tone of the conversation
- Only include decisions_made if clear decisions were made
- Only include follow_ups if follow-up items were discussed
- Return ONLY the JSON object, no additional text"""

    user_prompt = f"Analyze this transcript:\n\n{transcript_text}"
    
    ai_response = _call_groq(system_prompt, user_prompt, max_tokens=1500, temperature=0.2)
    
    if not ai_response:
        return None
    
    parsed = _extract_json_from_response(ai_response)
    
    if not parsed or "summary" not in parsed:
        # If JSON parsing failed, try to use the raw response as summary
        logger.warning("Could not parse AI response as JSON, using raw response")
        return {
            "summary": ai_response[:500],
            "action_items": [],
            "key_topics": [],
            "sentiment": "neutral"
        }
    
    # Ensure all required fields exist
    return {
        "summary": parsed.get("summary", ""),
        "action_items": parsed.get("action_items", []),
        "key_topics": parsed.get("key_topics", []),
        "sentiment": parsed.get("sentiment", "neutral"),
        "decisions_made": parsed.get("decisions_made", []),
        "follow_ups": parsed.get("follow_ups", [])
    }


def generate_custom_summary(transcript_raw: str, prompt: str) -> Dict[str, Any]:
    """
    Generate a custom AI summary based on user-provided prompt.
    Useful for asking specific questions about a transcript.
    """
    if not transcript_raw:
        return {"response": "No transcript available to analyze."}
    
    max_chars = 15000
    transcript_text = transcript_raw[:max_chars]
    
    system_prompt = """You are an expert meeting analyst AI. The user has provided a meeting transcript 
and a specific question or instruction about it. Analyze the transcript and respond to their request.
Be concise, professional, and actionable in your response."""

    user_prompt = f"""Transcript:
{transcript_text}

User Request: {prompt}"""

    ai_response = _call_groq(system_prompt, user_prompt, max_tokens=1500, temperature=0.3)
    
    if ai_response:
        return {"response": ai_response}
    else:
        return {"response": "AI analysis is currently unavailable. Please try again later."}


def _generate_extractive_summary(transcript_raw: str) -> Dict[str, Any]:
    """Fallback: basic extractive summarization without AI."""
    sentences = re.split(r'(?<=[.!?]) +', transcript_raw)
    
    action_keywords = ["will", "should", "need to", "must", "action", "deadline", 
                        "by", "todo", "follow up", "assign", "complete", "deliver"]
    
    action_items = []
    for sentence in sentences:
        if any(kw in sentence.lower() for kw in action_keywords):
            clean = sentence.strip()
            if len(clean) > 10:
                action_items.append(clean)
    
    # Summary: first 5 meaningful sentences
    summary_sentences = [s.strip() for s in sentences[:5] if len(s.strip()) > 10]
    summary = " ".join(summary_sentences)
    
    return {
        "summary": summary,
        "action_items": list(set(action_items)),
        "key_topics": [],
        "sentiment": "neutral"
    }
