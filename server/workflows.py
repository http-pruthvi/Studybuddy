import os
from sarvam import transcribe_audio, extract_concepts_and_cards
from database import write_deck_and_graph

def run_deck_generation_workflow(user_id: str, user_name: str, text: str = None, audio_base64: str = None, language_code: str = "en-IN", classroom_id: str = None, commit: bool = True) -> dict:
    """
    Orchestrates the durable tasks in sequence.
    Can be run directly or dispatched. Supports local execution.
    """
    # Step 1: Transcription
    if audio_base64:
        print("[Workflow] Transcribing input audio...")
        transcription_text = transcribe_audio(audio_base64, language_code)
        if text and text.strip():
            # Append typed addendum to transcribed text
            transcription_text = f"{transcription_text}\n\nAddendum: {text.strip()}"
    else:
        print("[Workflow] Using direct text input...")
        transcription_text = text or ""
        
    if not transcription_text.strip():
        transcription_text = "General Study Session"

    # Step 2: Extract Concepts & Flashcards
    print("[Workflow] Extracting concepts from text...")
    extraction_result = extract_concepts_and_cards(transcription_text, language_code)
    
    deck_title = extraction_result.get("deckTitle", "Study Deck")
    concepts = extraction_result.get("concepts", [])
    cards = extraction_result.get("cards", [])
    clarity_score = extraction_result.get("clarityScore", 1.0)
    gaps = extraction_result.get("gaps", [])

    deck_id = None
    created_at = None

    if commit:
        # Step 3: Write to Graph Database
        print("[Workflow] Saving to Neo4j AuraDB...")
        db_result = write_deck_and_graph(
            user_id=user_id,
            user_name=user_name,
            deck_title=deck_title,
            concepts=concepts,
            cards=cards,
            classroom_id=classroom_id
        )
        deck_id = db_result.get("deckId")
        created_at = db_result.get("createdAt")
    
    # Return standard response shape to client
    return {
        "text": transcription_text,
        "deckId": deck_id,
        "title": deck_title,
        "createdAt": created_at,
        "concepts": concepts,
        "cards": cards,
        "clarityScore": clarity_score,
        "gaps": gaps
    }


