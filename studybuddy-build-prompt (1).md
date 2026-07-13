# Task: Complete the StudyBuddy hackathon project (Expo + Render Workflows + Sarvam AI + Neo4j AuraDB + Base44)

## Context

I have a working Expo (React Native) app called StudyBuddy for HACKHAZARDS '26. It's a
"explain it to learn it" study app: the user explains a topic (typed or spoken), an LLM
turns it into flashcards, and the user quizzes themself. The existing scaffold already has:

- `App.js` — React Navigation stack (Home, Capture, Flashcards, Quiz)
- `screens/HomeScreen.js`, `CaptureScreen.js`, `FlashcardsScreen.js`, `QuizScreen.js`
- `utils/aiClient.js` — calls Anthropic or OpenAI directly from the client to generate
  flashcards, with an offline heuristic fallback
- `utils/storage.js` — AsyncStorage-based local persistence for decks
- `package.json`, `app.json`, `babel.config.js`, `.env.example`, `README.md`

This is NOT a chatbot. There is no conversational Q&A UI anywhere in this product. The
interaction model is: speak or type an explanation -> watch a knowledge graph grow ->
quiz yourself. Do not introduce a chat-style interface at any point.

## Hackathon context (for your awareness — affects scope/priority decisions)

- **Event:** HACKHAZARDS '26, organized by NAMESPACE Community (part of the NAMESPACE
  ecosystem). Billed as India's largest hackathon / one of the largest community-run
  hackathons globally. Fully online, 1-4 members per team.
- **Deadline:** submissions close today, Monday July 13, 2026, 11:59 PM. Registration is
  already closed (31,623 registered). Treat every build-order checkpoint as time-boxed —
  a working demo at each stop matters more than finishing every listed feature.
- **Total prize pool:** $6,000 cash, plus per-track bonuses below. Before final
  submission, re-check NAMESPACE's official Track Rules page for this event, since
  meeting the stated rules for each partner track (not just using the SDK) is what
  qualifies for that track's bonus.
- **Partner track rewards this project is targeting:**
  - Expo — 20 bonus points, $500 prize
  - Neo4j (AuraDB) — 20 bonus points, $500 prize
  - Base44 — 10 bonus points
  - Sarvam — $1,000 API credits
  - Render (Workflows) — $900 credits
- **Submission checklist implied by this:** the final README/submission text must
  explicitly name every theme and partner track used and how (judges scan for this), and
  the repo should be public with a working demo video, since that's standard for this
  format of hackathon.

I need to evolve this into a full **five-track, multi-theme submission** with a real
visual/social differentiator, using each of: **Expo, Sarvam AI, Neo4j AuraDB, Render
Workflows, and Base44** as genuine functional pieces. The deadline is today, so
prioritize a working end-to-end path over completeness. Follow the priority order in the
"Build order" section below and stop to give me a working demo at each checkpoint rather
than leaving things half-wired.

## Product concept (full vision)

Every concept a student explains — in English or an Indian regional language — becomes a
node in a **personal knowledge graph**. Concepts link to related and prerequisite
concepts. Critically, concepts that mean the same thing but were explained in different
languages resolve to the SAME underlying graph node (cross-language concept linking), so
a Hindi explanation and an English explanation of "photosynthesis" merge into one node.

Individual student graphs can optionally join a **classroom**, where their personal graphs
merge into a shared classroom knowledge map — letting a teacher see, at a glance, which
concepts the whole class has mastered and which are weak, without exposing any one
student's raw data (anonymized student IDs in the teacher view).

This spans six hackathon themes in one coherent product, not six bolted-on features —
every theme below is served by a feature that already exists for another reason, nothing
is added purely to check a theme box:
- **Learning & Knowledge Systems** — the core graph + flashcards + spaced repetition
- **Human Experience & Productivity** — frictionless voice capture, mastery streaks, a
  lightweight pre-session "how are you feeling" check-in that adjusts session length
  (keep this simple — a mood chip, not a health-tracking feature)
- **Public Systems, Governance & Civic Tech** — classroom mode as real learning-analytics
  infrastructure for teachers, especially relevant to India's linguistic diversity
- **Trust, Identity & Security** — anonymized student identifiers in any shared/teacher
  view; personal data never leaves the student's own graph
- **Media, Social & Interactive Platforms** — the classroom "peer glow" and streak
  leaderboard (see X-factor #4 below) reuse the same `LEARNED` edges already in Neo4j; no
  new backend, just a social view on existing data
- **Developer Tools & Software Infrastructure** — the Render Workflow + Neo4j graph API
  (`/decks/generate`, `/users/:id/graph`, `/classrooms/:id/heatmap`) is documented and
  presented as a reusable knowledge-graph service any edtech team could build on, not
  just an internal API for this one app (see "API documentation" under the Render
  Workflow service section below)

## The X-factor (what must be visually true in the demo, not just technically true)

1. **Live, explorable knowledge graph** as the primary UI metaphor — not a flashcard list
   as the home experience. The student should SEE a graph of nodes and edges growing as
   they add explanations. This is the hero visual for judges.
2. **Cross-language concept linking** — demoable: explain "photosynthesis" in English,
   then explain the same concept in Hindi in a separate capture, and show both resolve to
   one graph node instead of creating a duplicate.
3. **Classroom heat map** (second priority, after the individual graph explorer is solid)
   — a teacher-facing view (Base44) coloring concepts by class-wide mastery.
4. **Peer glow + streak leaderboard** — in a classroom context, a subtle visual marker on
   concepts a peer has already mastered, plus a simple ranked list of classroom members
   by mastery streak. Both read from the same `LEARNED` edges already written to Neo4j —
   no new data model, just two more views. This is the Media/Social angle: social proof
   and light competition, deliberately with NO chat, comments, or messaging feature
   attached to it.

Do not build a conversational chat interface for any of this — graph growth and flashcard
review are the only interaction surfaces.

## Target architecture

```
Expo mobile app
   -> triggers a Render Workflow run (HTTP POST with captured text/audio + language)
      Render Workflow (durable, multi-step):
        1. transcribe          - Sarvam Saaras v3 STT (skip if input was already text)
        2. extractConcepts     - Sarvam chat LLM (Sarvam-30B/105B): pull out concept
                                  names, a language-agnostic canonical topic label for
                                  each (for cross-language matching), relationships
                                  (RELATES_TO, PREREQUISITE_OF), and flashcard Q/A pairs
                                  as structured JSON
        3. resolveTopics        - match extracted concepts against existing Topic nodes
                                  in Neo4j by canonical label (exact match first; note a
                                  TODO for embedding/fuzzy match as a stretch goal) so the
                                  same idea in two languages merges into one node instead
                                  of duplicating
        4. writeGraph           - Neo4j AuraDB: upsert Topic + Concept nodes and
                                  relationship edges, link to the User, Deck, and
                                  (if applicable) Classroom
        5. returnDeck           - respond to the Expo client with the generated flashcards
                                  and the newly created/linked graph nodes
        6. updateMastery        - (triggered separately after a quiz) write
                                  LEARNED {score, lastReviewed} edges from User to Topic
   -> Neo4j AuraDB is the single source of truth for graph queries (what's due for
      review, what to learn next via PREREQUISITE_OF traversal, personal knowledge map,
      classroom aggregate heat map)
   -> Base44 dashboards (built by prompting Base44 in natural language):
        (a) individual student graph explorer (build this first)
        (b) classroom teacher heat map (build this second, after (a) works)
      both call the same Render Workflow service's read-only REST endpoints
```

## Neo4j graph schema

```cypher
(:User {id, name})
(:Classroom {id, name, joinCode})
(:Topic {id, canonicalName})          // language-agnostic concept identity
(:Concept {id, name, language})       // the specific-language instance a user explained
(:Deck {id, title, createdAt})

(:User)-[:OWNS]->(:Deck)
(:User)-[:MEMBER_OF]->(:Classroom)
(:Deck)-[:CONTAINS]->(:Concept)
(:Concept)-[:INSTANCE_OF]->(:Topic)
(:Topic)-[:RELATES_TO]->(:Topic)
(:Topic)-[:PREREQUISITE_OF]->(:Topic)
(:User)-[:LEARNED {score, lastReviewed}]->(:Topic)
```

Why the `Topic` vs `Concept` split: `Concept` is the specific thing a user explained in a
specific language ("प्रकाश संश्लेषण" in Hindi); `Topic` is the shared canonical identity
("photosynthesis") that both a Hindi and an English `Concept` point to via `INSTANCE_OF`.
All graph traversal, mastery tracking, and prerequisite logic happens at the `Topic`
level so cross-language linking works everywhere for free.

Useful queries this schema should support (implement as functions/endpoints):
- "What's due for review" — `Topic`s a user `LEARNED` where `lastReviewed` is older than
  N days, ordered by staleness.
- "What should I learn next" — traverse `PREREQUISITE_OF` outward from `Topic`s the user
  has `LEARNED` with a score above some threshold.
- "My knowledge map" — all of a user's `Topic`s (via their `Concept`s) and edges, for the
  graph explorer view.
- "Classroom heat map" — for all `User`s in a `Classroom`, aggregate `LEARNED` scores per
  `Topic` (e.g. average score, % of class who've learned it) so the teacher view can
  color each `Topic` node by class-wide mastery. Return only aggregate stats and
  anonymized per-student breakdowns (student index/initial, not full name) for this
  endpoint specifically.
- "Classroom leaderboard" — for all `User`s in a `Classroom`, rank by count of `LEARNED`
  edges with `score` above a threshold and recency of `lastReviewed` (a simple streak
  proxy is fine — don't over-engineer this into a full streak-calculation system).

## What to build

### 1. Render Workflow service (new directory: `server/`)

- TypeScript or Python, using the Render Workflow SDK (durable task decorators — check
  current docs at https://render.com/docs for exact SDK syntax, it's in beta).
- Expose an HTTP entrypoint (Express/FastAPI alongside the workflow service, or whatever
  the current Render Workflows starter template uses) with routes:
  - `POST /decks/generate` — body: `{ text?: string, audioBase64?: string, languageCode: string, userId: string, classroomId?: string }`.
    Triggers the workflow described above, returns the generated deck plus the graph
    nodes created/linked (or a run ID the client can poll if the SDK is async-only).
  - `GET /users/:userId/review-queue` — topics due for review.
  - `GET /users/:userId/graph` — full personal knowledge graph (Topics + edges) for the
    individual graph explorer.
  - `POST /users/:userId/mastery` — body: `{ topicId, score }`, updates the `LEARNED`
    edge after a quiz.
  - `GET /classrooms/:classroomId/heatmap` — aggregate class-wide mastery per Topic, with
    anonymized per-student breakdowns, for the teacher dashboard.
  - `POST /classrooms` and `POST /classrooms/:classroomId/join` — minimal classroom
    creation/joining via a join code, no auth system needed for the demo.
- Each workflow step should be a separate durable task/step per the SDK's pattern, so
  failures in one step (e.g. Sarvam rate limit) retry independently without re-running
  earlier steps.
- Read all credentials from environment variables (`SARVAM_API_KEY`, `NEO4J_URI`,
  `NEO4J_USERNAME`, `NEO4J_PASSWORD`). Add a `.env.example` for this service.
- Include a `render.yaml` blueprint for one-command deploy to Render.
- Add a `GET /classrooms/:classroomId/leaderboard` route returning classroom members
  ranked by mastery streak (reuses `LEARNED` edges, no new schema), for the peer
  glow/leaderboard feature described in the X-factor section.
- **API documentation (`server/README.md` or `docs/api.md`)** — document every route with
  method, path, request/response shape, and a working `curl` example, and frame it
  explicitly as a standalone knowledge-graph API other developers could integrate against
  (not just internal docs for this app). This file is what earns the Developer Tools &
  Software Infrastructure theme — it should read like a small public API reference, not a
  code comment dump.

### 2. Sarvam AI integration (inside the workflow service)

- Speech-to-text: Sarvam Saaras v3 (`speech_to_text.transcribe`), passing the user's
  selected `languageCode`.
- Concept + flashcard extraction: Sarvam's chat completion endpoint (or Sarvam-30B/105B
  via their SDK) with a system prompt that returns strict JSON, and CRITICALLY includes a
  canonical English topic label per concept for cross-language matching:
  ```json
  {
    "deckTitle": "string",
    "concepts": [
      {
        "id": "slug",
        "name": "string in the input language",
        "language": "hi-IN",
        "canonicalTopic": "photosynthesis",
        "relatesTo": ["canonicalTopic", ...],
        "prerequisiteOf": ["canonicalTopic", ...]
      }
    ],
    "cards": [
      { "front": "string", "back": "string", "conceptId": "slug" }
    ]
  }
  ```
- Use the official `sarvamai` Python SDK or their REST API directly if building in
  TypeScript (check `docs.sarvam.ai` for current Node/TS support). Handle and log API
  errors clearly; on failure, fall back to a simple heuristic (same pattern as the
  existing `utils/aiClient.js` mock fallback) so the pipeline degrades gracefully rather
  than hard-failing the whole run.

### 3. Neo4j AuraDB integration (inside the workflow service)

- Use the official Neo4j driver for whatever language the workflow service is in.
- Implement `resolveTopics`: for each extracted concept's `canonicalTopic` string, `MERGE`
  a `Topic` node by `canonicalName` (case-insensitive exact match for now — add a
  `// TODO: embedding-based fuzzy match` comment as a documented stretch goal), then
  `MERGE` the language-specific `Concept` node and an `INSTANCE_OF` edge to that `Topic`.
- Implement `writeGraph`: `MERGE` `RELATES_TO`/`PREREQUISITE_OF` edges between `Topic`
  nodes, `MERGE` the `Deck` and link it to the `User` (and `Classroom` if provided).
- Implement the four query functions described in the schema section above as reusable
  functions, called by the corresponding REST routes.
- Include a `schema.cypher` file with constraints (unique `id` on `User`, `Topic`,
  `Concept`, `Deck`, `Classroom`) and the example queries, so it's easy to verify in the
  Neo4j Aura console.

### 4. Expo client updates

- Update `utils/aiClient.js` (or add a new `utils/workflowClient.js`) so `CaptureScreen`
  calls the Render Workflow's `/decks/generate` endpoint instead of calling
  Anthropic/OpenAI directly. Keep the existing offline mock fallback for when the backend
  is unreachable, so the app is still demoable if the network/backend has issues.
- Add a language picker to `CaptureScreen` (start with English, Hindi, Tamil — match
  Sarvam's `languageCode` values, e.g. `en-IN`, `hi-IN`, `ta-IN`).
- Replace the flat deck list as the primary home experience with a **graph explorer**
  screen (`screens/GraphScreen.js`) that fetches `GET /users/:userId/graph` and renders
  Topics as nodes with visible RELATES_TO / PREREQUISITE_OF connections. This should be
  the app's centerpiece screen, not a secondary view — make `Home` route to this instead
  of (or alongside) the flat deck list. A force-directed or simple radial layout is fine;
  it does not need to be fully physics-based, but it must visually read as a graph, not a
  list, since this is the core X-factor for the demo.
- Add a lightweight classroom join flow: a join-code input on Home or a Settings screen
  that calls `POST /classrooms/:classroomId/join`, storing the resulting `classroomId`
  locally.
- If the user has joined a classroom, add a small "Classmates" tab or section
  (`screens/LeaderboardScreen.js`) that fetches `GET /classrooms/:classroomId/leaderboard`
  and shows a ranked list by streak, plus a subtle marker in the graph explorer on Topics
  a peer has already mastered (fetch this alongside the personal graph). No chat, no
  comments, no direct messaging — ranking and the mastery marker are the entire feature.
- Add a minimal mood/energy check-in chip (e.g. three emoji-free labeled buttons: "Fresh
  / OK / Tired") shown once per day before Capture, that's stored locally and can later
  inform session length suggestions — keep this deliberately lightweight, not a
  health-tracking feature.
- Add a generated `userId` stored locally, since there's no auth system — a UUID
  persisted in AsyncStorage on first launch is sufficient.
- Update `.env.example` to include `EXPO_PUBLIC_WORKFLOW_API_URL` pointing at the
  deployed Render service.

### 5. Base44 dashboards

These aren't code I write directly — they're built by prompting Base44's builder chat.
Build them in this order:

**(a) Individual student graph explorer — build first.** Write the exact prompt I should
paste into Base44 to generate a page that calls `GET /users/:userId/graph` and
`GET /users/:userId/review-queue`, and visually renders the student's own knowledge graph
plus a "due for review" list. This is a web mirror of the mobile app's graph screen, for
a student to check progress from a browser. Put this prompt in `docs/base44-prompt-student.md`.

**(b) Classroom teacher heat map — build second, only after (a) is confirmed working.**
Write the exact prompt for a page that calls `GET /classrooms/:classroomId/heatmap` and
renders topics colored by class-wide mastery, with an anonymized per-student breakdown
table. Put this prompt in `docs/base44-prompt-teacher.md`.

For both, note in the doc that I'll need to set the Render service URL as a Base44
integration and generate a read-only API key or leave the routes unauthenticated for the
demo.

## Build order (stop and confirm working state at each checkpoint)

1. Neo4j AuraDB schema + connectivity check (constraints created, can write/read a test
   `Topic`/`Concept` pair from a script, confirm two concepts with the same
   `canonicalTopic` merge into one `Topic` node).
2. Render Workflow service skeleton with all steps stubbed (mocked Sarvam/Neo4j calls),
   confirm the whole pipeline runs end-to-end and returns a deck.
3. Swap in real Sarvam calls for transcription + concept/flashcard extraction, including
   the `canonicalTopic` field.
4. Swap in real Neo4j writes for `resolveTopics` and `writeGraph`, and implement the five
   read queries (review queue, next-to-learn, personal graph, classroom heatmap,
   classroom leaderboard).
5. Wire the Expo client to the deployed (or locally running) Render service, and build
   the graph explorer screen as the new home experience.
6. Manually verify cross-language linking end-to-end: submit an English explanation of a
   topic, then a Hindi explanation of the same topic in a separate capture, confirm they
   resolve to one `Topic` node in the graph explorer.
7. Write the Base44 student graph explorer prompt doc (5a), then the classroom heat map
   prompt doc (5b) if time allows.
8. Build the classroom leaderboard screen + peer-glow markers in the graph explorer.
9. Write `docs/api.md` documenting every Render Workflow route as a standalone
   knowledge-graph API.
10. Update `README.md` to describe the full six-theme, five-track architecture, the
    cross-language linking mechanism, how to run every piece locally, and environment
    variables required — this doubles as hackathon submission text. Explicitly call out
    which hackathon themes and partner tracks are used and how, since judges scan for
    this. Before final submission, do a pass against NAMESPACE's published Track Rules
    for HACKHAZARDS '26 to confirm each partner integration meets that track's stated
    requirements, not just that the SDK is imported somewhere.

## Constraints and preferences

- No chatbot-style interface anywhere in this product — the interaction model is
  capture -> graph grows -> quiz, not conversational Q&A.
- Keep every external call wrapped in try/catch with a graceful fallback — a demo that
  degrades instead of crashing is more important than perfect error handling.
- Don't invent API shapes for Sarvam, Neo4j, or Render Workflows from memory if you're
  unsure — check current docs (`docs.sarvam.ai`, Neo4j driver docs, `render.com/docs`)
  since these are fast-moving products.
- Keep secrets out of source — everything through environment variables, with
  `.env.example` files kept up to date.
- Favor a working vertical slice over broad partial coverage. If time runs out, the
  priority order above should leave me with Expo + Sarvam + Neo4j + the individual graph
  explorer solid, even if the classroom heat map or Base44 dashboards don't get finished.
