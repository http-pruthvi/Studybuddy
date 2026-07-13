import os
from sarvam import transcribe_audio, extract_concepts_and_cards
from database import write_deck_and_graph

def run_deck_generation_workflow(user_id: str, user_name: str, text: str = None, audio_base64: str = None, language_code: str = "en-IN", classroom_id: str = None) -> dict:
    """
    Orchestrates the durable tasks in sequence.
    Can be run directly or dispatched. Supports local execution.
    """
    # Step 1: Transcription
    if audio_base64:
        print("[Workflow] Transcribing input audio...")
        transcription_text = transcribe_audio(audio_base64, language_code)
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
    
    # Return standard response shape to client
    return {
        "text": transcription_text,
        "deckId": db_result.get("deckId"),
        "title": db_result.get("title"),
        "createdAt": db_result.get("createdAt"),
        "concepts": db_result.get("concepts"),
        "cards": db_result.get("cards")
    }


