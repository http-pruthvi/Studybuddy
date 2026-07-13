import os
from typing import Optional
from fastapi import FastAPI, HTTPException, status, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from dotenv import load_dotenv

dotenv_path = os.path.join(os.path.dirname(__file__), '.env')
load_dotenv(dotenv_path, override=True)

from database import (
    init_driver, 
    close_driver, 
    get_user_graph, 
    get_review_queue, 
    get_next_to_learn,
    update_mastery,
    update_mastery_batch,
    get_classroom_heatmap, 
    get_classroom_leaderboard, 
    join_classroom,
    write_deck_and_graph,
    create_user_account,
    login_user_account,
    generate_token,
    decode_token
)
from workflows import run_deck_generation_workflow
from gemini import gather_topic_info, grade_student_answer
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

app = FastAPI(
    title="StudyBuddy Knowledge Graph & Generation Service",
    description="Render Workflow backed study assistance endpoint with Neo4j AuraDB & Sarvam AI",
    version="1.0.0"
)

# CORS Configuration - Environment Driven
allowed_origins_env = os.getenv("ALLOWED_ORIGINS", "")
if allowed_origins_env:
    ALLOWED_ORIGINS = [origin.strip() for origin in allowed_origins_env.split(",") if origin.strip()]
else:
    ALLOWED_ORIGINS = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True if ALLOWED_ORIGINS != ["*"] else False,
    allow_methods=["*"],
    allow_headers=["*"],
)

security = HTTPBearer()

def verify_user_token(credentials: HTTPAuthorizationCredentials = Depends(security)) -> str:
    """Verifies bearer JWT token and extracts the authenticated user_id."""
    token = credentials.credentials
    user_id = decode_token(token)
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session token"
        )
    return user_id

# Lifespans / Events
@app.on_event("startup")
def startup_event():
    init_driver()

@app.on_event("shutdown")
def shutdown_event():
    close_driver()

# Pydantic Request Models
class GenerateDeckRequest(BaseModel):
    text: Optional[str] = Field(None, description="The explanation typed by the user.")
    audioBase64: Optional[str] = Field(None, description="Base64 encoded audio string of spoken explanation.")
    languageCode: str = Field("en-IN", description="ISO language code supported by Sarvam (e.g. en-IN, hi-IN, ta-IN)")
    userId: str = Field(..., description="Unique client-generated user identifier")
    userName: Optional[str] = Field("Guest Student", description="User's screen name")
    classroomId: Optional[str] = Field(None, description="Optional class ID user is a member of")
    commit: Optional[bool] = Field(True, description="Whether to write directly to database immediately.")

class CommitDeckRequest(BaseModel):
    userId: str = Field(..., description="Unique user identifier")
    userName: str = Field(..., description="User's screen name")
    deckTitle: str = Field(..., description="The title of the generated study deck")
    concepts: list[dict] = Field(..., description="Extracted concept nodes")
    cards: list[dict] = Field(..., description="Extracted flashcards")
    classroomId: Optional[str] = Field(None, description="Optional classroom ID")

class MasteryUpdateRequest(BaseModel):
    topicId: str = Field(..., description="ID or canonical name of the topic")
    score: float = Field(..., description="Mastery score between 0.0 and 1.0", ge=0.0, le=1.0)

class JoinClassroomRequest(BaseModel):
    userId: str = Field(..., description="User ID joining the classroom")

class CreateClassroomRequest(BaseModel):
    classroomId: Optional[str] = Field(None, description="Predefined classroom ID. Generates UUID if empty.")

class RegisterUserRequest(BaseModel):
    username: str = Field(..., description="Unique user screen handle")
    password: str = Field(..., description="Secret sign-in password")
    name: str = Field(..., description="Student's screen name")
    
class LoginUserRequest(BaseModel):
    username: str = Field(..., description="User's unique screen handle")
    password: str = Field(..., description="Secret sign-in password")

class LearnTopicRequest(BaseModel):
    topic: str = Field(..., description="The name of the topic to research")
    userId: str = Field(..., description="Unique client-generated user identifier")
    userName: Optional[str] = Field("Guest Student", description="User's screen name")
    classroomId: Optional[str] = Field(None, description="Optional classroom ID")

class GradeRequest(BaseModel):
    question: str = Field(..., description="The flashcard question text")
    correctAnswer: str = Field(..., description="The correct answer text")
    studentAnswer: str = Field(..., description="The student's free-text answer")

class MasteryBatchItem(BaseModel):
    topicId: str = Field(..., description="Topic ID or canonical name")
    score: float = Field(..., description="Averaged mastery score 0.0-1.0", ge=0.0, le=1.0)

class MasteryBatchRequest(BaseModel):
    updates: list[MasteryBatchItem] = Field(..., description="List of topic mastery updates")

# REST Routes
@app.get("/")
def read_root():
    return {
        "service": "StudyBuddy Workflow API",
        "status": "healthy",
        "neo4j": "connected"
    }

@app.post("/decks/generate", status_code=status.HTTP_201_CREATED)
async def generate_deck(payload: GenerateDeckRequest, authed_user_id: str = Depends(verify_user_token)):
    """
    Triggers the generation workflow. If audio is provided, it is transcribed first.
    Then concept and flashcard details are extracted and stored inside Neo4j AuraDB.
    """
    if payload.userId != authed_user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to act on behalf of this user namespace"
        )
    try:
        result = run_deck_generation_workflow(
            user_id=payload.userId,
            user_name=payload.userName,
            text=payload.text,
            audio_base64=payload.audioBase64,
            language_code=payload.languageCode,
            classroom_id=payload.classroomId,
            commit=payload.commit
        )
        return result
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Workflow execution failed: {str(e)}"
        )

@app.post("/decks/commit", status_code=status.HTTP_201_CREATED)
async def commit_deck(payload: CommitDeckRequest, authed_user_id: str = Depends(verify_user_token)):
    """
    Saves an extracted concept map/flashcard deck directly to the Neo4j database.
    Used when confirmation is deferred (e.g. after verifying clarityScore and gaps).
    """
    if payload.userId != authed_user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to act on behalf of this user namespace"
        )
    try:
        db_result = write_deck_and_graph(
            user_id=payload.userId,
            user_name=payload.userName,
            deck_title=payload.deckTitle,
            concepts=payload.concepts,
            cards=payload.cards,
            classroom_id=payload.classroomId
        )
        return db_result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to commit deck to database: {str(e)}"
        )

@app.post("/topics/learn", status_code=status.HTTP_201_CREATED)
async def learn_topic(payload: LearnTopicRequest, authed_user_id: str = Depends(verify_user_token)):
    """
    Calls Gemini to research and generate concepts & flashcards for any topic in the world,
    then writes them directly to Neo4j AuraDB.
    """
    if payload.userId != authed_user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to act on behalf of this user namespace"
        )
    try:
        print(f"[API] Auto-learning topic: '{payload.topic}' for user '{payload.userId}'")
        extraction_result = gather_topic_info(payload.topic)
        
        deck_title = extraction_result.get("deckTitle", f"Curriculum: {payload.topic}")
        concepts = extraction_result.get("concepts", [])
        cards = extraction_result.get("cards", [])
        
        db_result = write_deck_and_graph(
            user_id=payload.userId,
            user_name=payload.userName,
            deck_title=deck_title,
            concepts=concepts,
            cards=cards,
            classroom_id=payload.classroomId
        )
        
        return {
            "topic": payload.topic,
            "deckId": db_result.get("deckId"),
            "title": db_result.get("title"),
            "createdAt": db_result.get("createdAt"),
            "concepts": db_result.get("concepts"),
            "cards": db_result.get("cards")
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gemini topic generation failed: {str(e)}"
        )

@app.get("/users/{userId}/graph")
def get_graph(userId: str, authed_user_id: str = Depends(verify_user_token)):
    """
    Fetches the personal concept knowledge graph for the given student.
    Returns nodes (topics) and edges (relationships) for direct UI rendering.
    """
    if userId != authed_user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to requested user graph"
        )
    try:
        return get_user_graph(userId)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@app.get("/users/{userId}/review-queue")
def get_user_review_queue(userId: str, authed_user_id: str = Depends(verify_user_token)):
    """
    Fetches the list of concepts/topics due for spacing-based review.
    """
    if userId != authed_user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to requested user review queue"
        )
    try:
        return get_review_queue(userId)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@app.get("/users/{userId}/next-to-learn")
def get_user_next_to_learn(userId: str, authed_user_id: str = Depends(verify_user_token)):
    """
    Finds upcoming recommended topics based on prerequisite connections of mastered topics.
    """
    if userId != authed_user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to requested user recommendations"
        )
    try:
        return get_next_to_learn(userId)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@app.post("/users/{userId}/mastery")
def post_mastery(userId: str, payload: MasteryUpdateRequest, authed_user_id: str = Depends(verify_user_token)):
    """
    Updates the mastery score for a specific topic node.
    Triggers streak counters and sets timestamps in the relation.
    """
    if userId != authed_user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to update user mastery logs"
        )
    try:
        result = update_mastery(
            user_id=userId,
            topic_id=payload.topicId,
            score=payload.score
        )
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@app.post("/users/{userId}/mastery/batch")
def post_mastery_batch(userId: str, payload: MasteryBatchRequest, authed_user_id: str = Depends(verify_user_token)):
    """
    Batch-updates mastery scores for multiple topics in a single UNWIND Cypher call.
    Used by the quiz results screen to submit all scores at once.
    """
    if userId != authed_user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to update user mastery logs"
        )
    try:
        updates = [item.model_dump() for item in payload.updates]
        result = update_mastery_batch(user_id=userId, updates=updates)
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@app.post("/grade")
def grade_answer(payload: GradeRequest, authed_user_id: str = Depends(verify_user_token)):
    """
    Uses Gemini LLM to evaluate a student's free-text answer against the correct answer.
    Returns {score: 0.0-1.0, feedback: "1-sentence explanation"}.
    """
    try:
        result = grade_student_answer(
            question=payload.question,
            correct_answer=payload.correctAnswer,
            student_answer=payload.studentAnswer
        )
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@app.post("/classrooms")
def create_classroom(payload: CreateClassroomRequest):
    """
    Utility endpoint to register a new classroom namespace.
    """
    c_id = payload.classroomId or f"class-{os.urandom(3).hex()}"
    try:
        # Register empty classroom stub in DB
        join_classroom(user_id="SYSTEM", classroom_id=c_id)
        return {"status": "success", "classroomId": c_id}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@app.post("/classrooms/{classroomId}/join")
def join_classroom_endpoint(classroomId: str, payload: JoinClassroomRequest, authed_user_id: str = Depends(verify_user_token)):
    """
    Adds a student to a classroom by joining their node representation.
    """
    if payload.userId != authed_user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to join classroom under different namespace"
        )
    try:
        result = join_classroom(
            user_id=payload.userId,
            classroom_id=classroomId
        )
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@app.get("/classrooms/{classroomId}/heatmap")
def get_classroom_heatmap_endpoint(classroomId: str):
    """
    Teacher view endpoint. Returns class-wide topic coverage scores
    along with anonymized list breakdown of student progress.
    """
    try:
        return get_classroom_heatmap(classroomId)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@app.get("/classrooms/{classroomId}/leaderboard")
def get_classroom_leaderboard_endpoint(classroomId: str):
    """
    Social feature endpoint. Renders rank, streak, and mastered topics count
    for peer motivation.
    """
    try:
        return get_classroom_leaderboard(classroomId)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@app.post("/users/register", status_code=status.HTTP_201_CREATED)
def register_user(payload: RegisterUserRequest):
    """Registers a new student user in Neo4j with hashed credentials."""
    try:
        result = create_user_account(
            username=payload.username,
            password=payload.password,
            name=payload.name
        )
        # Generate JWT Token and merge it
        token = generate_token(result["id"])
        result["token"] = token
        return result
    except Exception as e:
        if "already exists" in str(e):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username already registered"
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@app.post("/users/login")
def login_user(payload: LoginUserRequest):
    """Authenticates student username and password."""
    try:
        result = login_user_account(
            username=payload.username,
            password=payload.password
        )
        # Generate JWT Token and merge it
        token = generate_token(result["id"])
        result["token"] = token
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e)
        )

if __name__ == "__main__":
    import uvicorn
    # Start ASGI server on standard port 8000
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
