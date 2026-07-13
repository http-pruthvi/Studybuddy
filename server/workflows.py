import os
from render_sdk import Workflows
from sarvam import transcribe_audio, extract_concepts_and_cards
from database import write_deck_and_graph

# Initialize Render Workflows application
# By default, Render SDK requires Workflows() instance
app = Workflows()

@app.task
def transcribe_step(audio_base64: str, language_code: str) -> str:
    """
    Durable task for transcribing audio via Sarvam STT.
    """
    print(f"[Workflow Task] Starting transcription step...")
    return transcribe_audio(audio_base64, language_code)

@app.task
def extract_concepts_step(text: str, language_code: str) -> dict:
    """
    Durable task for extracting concepts and flashcards via Sarvam LLM.
    """
    print(f"[Workflow Task] Starting concept extraction step...")
    return extract_concepts_and_cards(text, language_code)

@app.task
def write_graph_step(user_id: str, user_name: str, deck_title: str, concepts: list, cards: list, classroom_id: str = None) -> dict:
    """
    Durable task for writing the deck and concept nodes/edges to Neo4j.
    """
    print(f"[Workflow Task] Starting database write step...")
    return write_deck_and_graph(
        user_id=user_id,
        user_name=user_name,
        deck_title=deck_title,
        concepts=concepts,
        cards=cards,
        classroom_id=classroom_id
    )

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

if __name__ == "__main__":
    # Start the workflow worker if executed as entrypoint (standard Render Workflows worker pattern)
    print("Starting Render Workflows worker node...")
    app.start()
