# StudyBuddy API: Multi-Lingual Knowledge Graph & Learning Service

Welcome to the **StudyBuddy API Reference**. This service provides a standalone, production-ready, and developer-accessible **Knowledge Graph Service** for educational technology platforms.

Designed specifically to support **multi-lingual active recall** systems, it abstracts the complexities of durable execution pipelines (transcription and LLM schema mapping) and provides structured operations to construct, trace, query, and merge user learning nodes using a robust graph representation.

---

## Service Architecture

```
                                      +-------------------------------+
                                      |   Render Workflows engine     |
                                      |   (Durable Execution Worker)  |
                                      +---------------+---------------+
                                                      |
                                                      | Transcribe & Extract
                                                      v
[Client Apps] === HTTP REST ===> [ FastAPI Server ] ====> [ Neo4j AuraDB ]
                                                      
```

- **Runtime Engines**: Python FastAPI (REST Gateway) + Render Workflows (Stateful Background Tasks).
- **Core Database**: Neo4j AuraDB (Semantic Property Graph).
- **AI Models**: Sarvam AI Saaras v3 (Speech-to-Text) + Sarvam Chat Completion LLMs.

---

## Authentication

All endpoints expect connection variables and credentials to be defined via environment configurations on deployment. In client-facing scenarios, request parameters require:
- **`userId`**: A unique UUID/token generated on initial launch by the client app.
- **`classroomId`**: An optional namespace identifier for classrooms.

---

## API Endpoints Reference

### 1. Generate Study Deck & Extract Concepts
Triggers the multi-lingual parsing and concept extraction pipeline. If `audioBase64` is provided, it is transcribed via Speech-to-Text first. The extracted concepts are translated to canonical English topics and linked together in Neo4j.

*   **Endpoint:** `POST /decks/generate`
*   **Content-Type:** `application/json`
*   **Request Payload:**
    ```json
    {
      "text": "Photosynthesis is the process where green plants turn sunlight into energy.",
      "audioBase64": null,
      "languageCode": "en-IN",
      "userId": "usr_9f43e390-1c09-4a4b",
      "userName": "Pruthvi Kumar",
      "classroomId": "class_sih2026"
    }
    ```
*   **Response Payload (`201 Created`):**
    ```json
    {
      "text": "Photosynthesis is the process where green plants turn sunlight into energy.",
      "deckId": "deck_8a7d9b23-cd82-4f3b",
      "title": "Photosynthesis Basics",
      "createdAt": "2026-07-13T08:00:00Z",
      "concepts": [
        {
          "id": "photosynthesis",
          "name": "Photosynthesis",
          "language": "en-IN",
          "canonicalTopic": "photosynthesis",
          "relatesTo": ["sunlight"],
          "prerequisiteOf": []
        }
      ],
      "cards": [
        {
          "front": "What is Photosynthesis?",
          "back": "The process by which plants turn light into energy.",
          "conceptId": "photosynthesis"
        }
      ]
    }
    ```

*   **Example curl Call:**
    ```bash
    curl -X POST http://localhost:8000/decks/generate \
      -H "Content-Type: application/json" \
      -d '{
        "text": "Plants use chlorophyll to absorb light for photosynthesis.",
        "languageCode": "en-IN",
        "userId": "usr_test_123"
      }'
    ```

---

### 2. Fetch Personal Knowledge Graph
Returns all concepts and topics studied by a student, along with their masteries and the visual relationship connections between them.

*   **Endpoint:** `GET /users/{userId}/graph`
*   **Response Payload (`200 OK`):**
    ```json
    {
      "nodes": [
        {
          "id": "photosynthesis",
          "label": "photosynthesis",
          "score": 0.85
        },
        {
          "id": "chlorophyll",
          "label": "chlorophyll",
          "score": 0.50
        }
      ],
      "edges": [
        {
          "source": "chlorophyll",
          "target": "photosynthesis",
          "type": "RELATES_TO"
        }
      ]
    }
    ```

*   **Example curl Call:**
    ```bash
    curl -X GET http://localhost:8000/users/usr_test_123/graph
    ```

---

### 3. Update Concept Mastery
Updates the student's mastery score for a specific topic (typically after a quiz). This modifies the `LEARNED` relation properties and increments or resets the user's daily study streak.

*   **Endpoint:** `POST /users/{userId}/mastery`
*   **Content-Type:** `application/json`
*   **Request Payload:**
    ```json
    {
      "topicId": "photosynthesis",
      "score": 0.95
    }
    ```
*   **Response Payload (`200 OK`):**
    ```json
    {
      "status": "success",
      "topicId": "photosynthesis",
      "score": 0.95
    }
    ```

*   **Example curl Call:**
    ```bash
    curl -X POST http://localhost:8000/users/usr_test_123/mastery \
      -H "Content-Type: application/json" \
      -d '{
        "topicId": "photosynthesis",
        "score": 0.95
      }'
    ```

---

### 4. Fetch Spaced Repetition Review Queue
Calculates which topics are due for review based on their last active study date, sorted by staleness.

*   **Endpoint:** `GET /users/{userId}/review-queue`
*   **Response Payload (`200 OK`):**
    ```json
    [
      {
        "id": "chlorophyll",
        "name": "chlorophyll",
        "score": 0.50,
        "lastReviewed": "2026-07-10T12:00:00Z"
      }
    ]
    ```

*   **Example curl Call:**
    ```bash
    curl -X GET http://localhost:8000/users/usr_test_123/review-queue
    ```

---

### 5. Fetch Next Suggestions to Learn
Recommends upcoming topics by traversing prerequisite paths (`PREREQUISITE_OF`) outward from concepts the user has already mastered (score >= 0.7) but has not studied yet.

*   **Endpoint:** `GET /users/{userId}/next-to-learn`
*   **Response Payload (`200 OK`):**
    ```json
    [
      {
        "id": "plant_respiration",
        "name": "plant_respiration"
      }
    ]
    ```

*   **Example curl Call:**
    ```bash
    curl -X GET http://localhost:8000/users/usr_test_123/next-to-learn
    ```

---

### 6. Classroom Heat Map (Teacher Dashboard Endpoint)
Provides aggregate topic mastery metrics for a classroom. Nodes are summarized for heat-mapping in teacher interfaces. In compliance with student security rules, detailed student breakdowns are anonymized.

*   **Endpoint:** `GET /classrooms/{classroomId}/heatmap`
*   **Response Payload (`200 OK`):**
    ```json
    {
      "classroom": "class_sih2026",
      "topics": [
        {
          "topicId": "photosynthesis",
          "name": "photosynthesis",
          "averageScore": 0.88,
          "masteredCount": 12,
          "students": [
            { "studentAlias": "Student 1", "score": 0.95 },
            { "studentAlias": "Student 2", "score": 0.81 }
          ]
        }
      ]
    }
    ```

*   **Example curl Call:**
    ```bash
    curl -X GET http://localhost:8000/classrooms/class_sih2026/heatmap
    ```

---

### 7. Classroom Leaderboard (Streak Ranking)
Calculates active study streaks and concept masteries across all users in a classroom. Used to build peer engagement leaderboards.

*   **Endpoint:** `GET /classrooms/{classroomId}/leaderboard`
*   **Response Payload (`200 OK`):**
    ```json
    [
      {
        "userId": "usr_9f43e390",
        "userName": "Pruthvi Kumar",
        "streak": 5,
        "masteredCount": 8
      },
      {
        "userId": "usr_00b167a4",
        "userName": "Rahul Sharma",
        "streak": 3,
        "masteredCount": 6
      }
    ]
    ```

*   **Example curl Call:**
    ```bash
    curl -X GET http://localhost:8000/classrooms/class_sih2026/leaderboard
    ```

---

### 8. Join Classroom
Associates a student with a classroom join code. No sign-up flows or passwords needed.

*   **Endpoint:** `POST /classrooms/{classroomId}/join`
*   **Content-Type:** `application/json`
*   **Request Payload:**
    ```json
    {
      "userId": "usr_test_123"
    }
    ```
*   **Response Payload (`200 OK`):**
    ```json
    {
      "status": "success",
      "classroomId": "class_sih2026"
    }
    ```

*   **Example curl Call:**
    ```bash
    curl -X POST http://localhost:8000/classrooms/class_sih2026/join \
      -H "Content-Type: application/json" \
      -d '{
        "userId": "usr_test_123"
      }'
    ```
