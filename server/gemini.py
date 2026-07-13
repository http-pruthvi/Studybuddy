import os
import requests
import json
from dotenv import load_dotenv

# Ensure configuration is loaded relative to current file path
dotenv_path = os.path.join(os.path.dirname(__file__), '.env')
load_dotenv(dotenv_path, override=True)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

def gather_topic_info(topic_name: str) -> dict:
    """
    Calls Gemini 2.5 Flash to automatically research and extract concept maps/flashcards
    about any topic in the world, returning it as a structured JSON object.
    """
    if not GEMINI_API_KEY:
        print("Gemini API Key is missing. Returning heuristic stub.")
        return get_gemini_fallback(topic_name)

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={GEMINI_API_KEY}"
    
    system_instruction = (
        "You are an expert tutor. Your task is to research the user's requested topic and generate a structured "
        "learning curriculum. Break down the topic into 3 to 6 key concepts, detail their connections (relatesTo, prerequisiteOf), "
        "and generate 5 to 10 active recall flashcards.\n\n"
        "You MUST return a JSON object with this exact structure (do not wrap in markdown or provide any explanation):\n"
        "{\n"
        "  \"deckTitle\": \"Title of the topic (e.g. Introduction to Black Holes)\",\n"
        "  \"concepts\": [\n"
        "    {\n"
        "      \"id\": \"lowercase_slug_unique_within_deck\",\n"
        "      \"name\": \"Concept Name (e.g. Event Horizon)\",\n"
        "      \"language\": \"en-IN\",\n"
        "      \"canonicalTopic\": \"canonical_english_name\",\n"
        "      \"description\": \"A simple, clear 1-2 sentence explanation of this concept that teaches it to the user.\",\n"
        "      \"relatesTo\": [\"prerequisite_or_related_canonical_name\"],\n"
        "      \"prerequisiteOf\": [\"dependent_concept_canonical_name\"]\n"
        "    }\n"
        "  ],\n"
        "  \"cards\": [\n"
        "    {\n"
        "      \"front\": \"Active recall question text?\",\n"
        "      \"back\": \"Short clear answer text.\",\n"
        "      \"conceptId\": \"slug_defined_above\"\n"
        "    }\n"
        "  ]\n"
        "}"
    )

    payload = {
        "contents": [{
            "parts": [{
                "text": f"Topic: {topic_name}"
            }]
        }],
        "systemInstruction": {
            "parts": [{
                "text": system_instruction
            }]
        },
        "generationConfig": {
            "responseMimeType": "application/json",
            "temperature": 0.2
        }
    }

    headers = {
        "Content-Type": "application/json"
    }

    try:
        print(f"[Gemini] Researching and gathering info on: {topic_name}...")
        response = requests.post(url, headers=headers, json=payload, timeout=30)
        
        if response.status_code == 200:
            res_json = response.json()
            raw_text = res_json['candidates'][0]['content']['parts'][0]['text'].strip()
            
            # Clean markdown wraps if any
            if raw_text.startswith("```"):
                raw_text = raw_text.replace("```json", "", 1).replace("```", "", 1).strip()
                
            return json.loads(raw_text)
        else:
            print(f"[Gemini] API failed with status {response.status_code}: {response.text}")
            return get_gemini_fallback(topic_name)
    except Exception as e:
        print(f"[Gemini] Exception during API call: {e}")
        return get_gemini_fallback(topic_name)

def get_gemini_fallback(topic_name: str) -> dict:
    """Fallback generator in case Gemini is offline or rate limited."""
    slug = topic_name.strip().lower().replace(" ", "_")
    return {
        "deckTitle": f"Research on {topic_name}",
        "concepts": [
            {
                "id": slug,
                "name": topic_name,
                "language": "en-IN",
                "canonicalTopic": slug,
                "relatesTo": [],
                "prerequisiteOf": []
            }
        ],
        "cards": [
            {
                "front": f"What is the definition of {topic_name}?",
                "back": f"The topic {topic_name} represents an area of study containing multiple interrelated concepts.",
                "conceptId": slug
            }
        ]
    }

def grade_student_answer(question: str, correct_answer: str, student_answer: str) -> dict:
    """
    Calls Gemini to evaluate a student's free-text answer against the correct answer.
    Returns {score: 0.0-1.0, feedback: "1-sentence explanation"}.
    """
    if not GEMINI_API_KEY:
        # Offline fallback: simple keyword overlap heuristic
        return _heuristic_grade(correct_answer, student_answer)

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={GEMINI_API_KEY}"

    system_instruction = (
        "You are a fair, encouraging tutor grading a student's answer. "
        "Compare the student's answer to the correct answer and return a JSON object with exactly two fields:\n"
        '{"score": <float 0.0 to 1.0>, "feedback": "<1 sentence of constructive feedback>"}\n\n'
        "Scoring guide:\n"
        "- 1.0: Fully correct, covers all key points\n"
        "- 0.7-0.9: Mostly correct, minor gaps or imprecise wording\n"
        "- 0.4-0.6: Partially correct, missing important details\n"
        "- 0.1-0.3: Shows some understanding but largely incorrect\n"
        "- 0.0: Completely wrong or blank\n\n"
        "Do not wrap in markdown. Return only the JSON object."
    )

    user_text = (
        f"Question: {question}\n"
        f"Correct Answer: {correct_answer}\n"
        f"Student's Answer: {student_answer}"
    )

    payload = {
        "contents": [{"parts": [{"text": user_text}]}],
        "systemInstruction": {"parts": [{"text": system_instruction}]},
        "generationConfig": {
            "responseMimeType": "application/json",
            "temperature": 0.1
        }
    }

    try:
        print(f"[Gemini] Grading student answer...")
        response = requests.post(url, headers={"Content-Type": "application/json"}, json=payload, timeout=15)

        if response.status_code == 200:
            res_json = response.json()
            raw_text = res_json['candidates'][0]['content']['parts'][0]['text'].strip()
            if raw_text.startswith("```"):
                raw_text = raw_text.replace("```json", "", 1).replace("```", "", 1).strip()
            result = json.loads(raw_text)
            score = max(0.0, min(1.0, float(result.get("score", 0.5))))
            feedback = result.get("feedback", "Review the correct answer for more detail.")
            return {"score": round(score, 2), "feedback": feedback}
        else:
            print(f"[Gemini] Grading API failed with status {response.status_code}")
            return _heuristic_grade(correct_answer, student_answer)
    except Exception as e:
        print(f"[Gemini] Grading exception: {e}")
        return _heuristic_grade(correct_answer, student_answer)

def _heuristic_grade(correct_answer: str, student_answer: str) -> dict:
    """Simple keyword-overlap fallback grader when Gemini is unavailable."""
    if not student_answer or not student_answer.strip():
        return {"score": 0.0, "feedback": "No answer provided."}

    correct_words = set(correct_answer.lower().split())
    student_words = set(student_answer.lower().split())
    # Remove common stop words
    stop_words = {"the", "a", "an", "is", "are", "was", "were", "of", "in", "to", "and", "or", "it", "that", "this", "for", "on", "with", "as", "by", "at"}
    correct_keywords = correct_words - stop_words
    student_keywords = student_words - stop_words

    if not correct_keywords:
        return {"score": 0.5, "feedback": "Unable to evaluate — review the correct answer."}

    overlap = len(correct_keywords & student_keywords)
    score = round(min(1.0, overlap / len(correct_keywords)), 2)

    if score >= 0.7:
        feedback = "Good job! You covered the key points."
    elif score >= 0.4:
        feedback = "Partially correct — review the answer for missing details."
    else:
        feedback = "Needs improvement — compare your answer with the correct one."

    return {"score": score, "feedback": feedback}

