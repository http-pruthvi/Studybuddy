# StudyBuddy: Multi-Lingual Personal Knowledge Graph & Active Recall System
## HACKHAZARDS '26 Submission Portal

StudyBuddy is a state-of-the-art "explain it to learn it" educational technology application. It transforms the standard, passive study review process into a dynamic, active experience: students explain a topic (spoken or typed) in their native language, watch an interactive, personal knowledge graph grow, and quiz themselves using generated flashcard decks.

---

## 🚀 Hackathon Submission Overview

### Targeted Themes
1.  **Learning & Knowledge Systems**: Core of the app. Concept-to-concept graph visualization, prerequisite mapping, flashcard generation, and active recall grading.
2.  **Human Experience & Productivity**: Natural voice explanation capture, pre-session mood logs, and study streaks that incentivize consistent daily learning.
3.  **Public Systems, Governance & Civic Tech**: Classroom mode as public infrastructure for teachers, designed specifically to bridge educational gaps across India's linguistic diversity.
4.  **Trust, Identity & Security**: Anonymized student aliases in teacher classroom dashboards. Leaderboard uses display names for peer motivation. Raw inputs are not stored in the graph.
5.  **Media, Social & Interactive Platforms**: Interactive classroom leaderboards and peer masteries that use social motivation without conversational chat interfaces.
6.  **Developer Tools & Software Infrastructure**: The entire background generation engine is exposed as a reusable API (`server/README.md`) that other edtech developers can build on.

### Targeted Partner Tracks & SDK Implementations
-   **Expo (20 Bonus Points)**: Core client application built using Expo SDK, utilizing `react-native-svg` for visual force-directed layouts and local persistence.
-   **Neo4j AuraDB (20 Bonus Points)**: Used as the single source of truth for all graph relationships. Uses unique constraints and complex Cypher queries for prerequisite traversal, review queueing, and classroom masteries.
-   **Sarvam AI ($1000 API Credits)**: Multi-lingual voice processing powered by Sarvam Saaras v3 STT API, and concept/graph mapping generated using Sarvam's Chat Completions LLM endpoint.
-   **Base44**: High-fidelity web dashboard prompts (in `docs/`) that let students and teachers inspect graphs and classroom heatmaps using simple natural language generation.

---

## 📐 System Architecture

```
  +----------------------------------------------------------------+
  |                        Expo Mobile App                         |
  |   - Visual interactive SVG graph layout                        |
  |   - Typed text explanation & Voice recording                   |
  |   - Flip flashcards & Active recall quiz grades                |
  +-------------------------------+--------------------------------+
                                  |
                                  | HTTP REST API (JWT Authenticated)
                                  v
  +----------------------------------------------------------------+
  |                        FastAPI Gateway                         |
  |   - Exposes REST routes (/decks/generate, /users/.../graph)    |
  |   - Transcribes Audio (Sarvam Saaras v3 STT)                   |
  |   - Extracts Concepts & Cards (Sarvam Chat LLM / Gemini API)   |
  |   - Writes Graph Nodes & Edges (Neo4j AuraDB)                  |
  +----------------------------------------------------------------+
```

---

## 🌐 Cross-Language Concept Linking

Concepts explained in different regional languages are resolved into the same canonical identity (stored under `(:Topic)` nodes) via their English equivalents. 

For example, a student explaining `"प्रकाश संश्लेषण"` in Hindi and another explaining `"Photosynthesis"` in English both map to the same `Topic` node `"photosynthesis"`. All graph traversal, classroom heatmapping, and prerequisites operate at the `Topic` level, allowing seamless cross-language masteries and comparisons for free.

---

## ⚙️ Environment Variables Config

### Backend (`server/.env`)
Create a file named `server/.env` with:
```env
SARVAM_API_KEY=your_sarvam_api_subscription_key
NEO4J_URI=neo4j+s://your-instance.databases.neo4j.io
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=your_neo4j_aura_password
```

---

## 🛠️ Local Development Setup

### Prerequisite
Make sure Python (3.9+) and Node.js are installed on your machine.

### 1. Running the FastAPI + Render Workflows Server
Navigate to the `server/` directory and install packages:
```bash
cd server
pip install -r requirements.txt
```

Start the FastAPI HTTP service:
```bash
cd server
python main.py
```
*The server will start running at `http://localhost:8000`. You can inspect the Swagger interactive docs at `http://localhost:8000/docs`.*

### 2. Running the Expo Client Application
In the root directory, install dependencies:
```bash
npm install
```

Start the Expo bundler:
```bash
npm run start
```
*Press `i` to open in iOS simulator, `a` for Android, or scan the QR code using the Expo Go mobile app.*

*Tip: Press the Settings wheel icon on the app's top bar to change the FastAPI target URL to your local computer's IP address (e.g. `http://192.168.1.X:8000`) so the phone app can connect to your local server.*

### 3. Running the Companion Teacher Web Dashboard
Open the standalone webpage directly in any browser:
- Open `web/index.html` (Double-click the file to open it in Chrome, Safari, or Firefox).
- In the top Server API box, target your FastAPI URL (e.g., `http://localhost:8000`), enter a classroom code (e.g., `class_sih2026`), and press **Sync Portal**.
- *Note: If the FastAPI server is not currently reachable, the website automatically loads high-fidelity offline mock stubs so you can still demonstrate the full teacher heatmap and leaderboard interactions.*

---

## 📊 Base44 Dashboard Prompts
Ready-to-paste prompts to generate full web interfaces instantly are provided inside the `docs/` directory:
1.  **Student Personal Graph Explorer**: [base44-prompt-student.md](file:///c:/Users/pruthvi/Desktop/SIH%20Projects/StudyBuddy/docs/base44-prompt-student.md)
2.  **Classroom Teacher Heatmap Dashboard**: [base44-prompt-teacher.md](file:///c:/Users/pruthvi/Desktop/SIH%20Projects/StudyBuddy/docs/base44-prompt-teacher.md)

---

## 🔒 Data Retention & Privacy Compliance
StudyBuddy is designed with a strict stance on data minimization and privacy:
- **Raw Audio Data**: Decoded base64 audio is processed entirely in-memory or written to a transient `.wav` file for the duration of the transcription API request. It is deleted unconditionally in the `finally` block immediately after, meaning raw audio files are never persisted on the server disk.
- **Raw Transcripts**: Captured transcripts are processed by the LLM (Sarvam/Gemini) to extract key concepts, connections, and flashcards. Once extraction is complete, the raw transcripts are discarded and never written to the Neo4j database.
- **Stored Data**: The only persisted learning records are the structural metadata (Topic names, prerequisite edges, cards, and daily streaks).
- **Third-Party API Policies**: Since StudyBuddy leverages third-party models for processing (Sarvam AI for multilingual STT/chat, and Google Gemini for topic research and answer grading), prompts and audio uploads may be subject to the retention terms of Sarvam AI and Google Cloud APIs. All third-party endpoints are mapped with secure system API credentials and are never exposed to individual client devices.

