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
