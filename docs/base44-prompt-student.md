# Base44 Builder Prompt: Student Personal Knowledge Graph Explorer

Copy and paste the prompt below into the Base44 dashboard builder chat to automatically generate the student web portal.

---

### BASE44 BUILDER PROMPT:

```text
Build a responsive student study dashboard with a dark mode theme matching the following specifications:

1. INTEGRATION CONFIGURATION:
   - Configure a REST integration targeting the StudyBuddy server API.
   - Endpoint A: GET `/users/{userId}/graph` to fetch nodes and edge relations.
   - Endpoint B: GET `/users/{userId}/review-queue` to fetch concepts due for spacing-based review.
   - Add a user-input field in the page header for `{userId}` (Text input, default placeholder: "usr_test_123") which updates the requests reactively.

2. PAGE LAYOUT:
   - Header: Dark navigation bar. Show the app name "StudyBuddy Student Portal" and a small active status indicator. Place the "Student ID Input" box on the right.
   - Grid layout containing two main visual columns:
     - Left Column (60% width): "Your Live Knowledge Graph"
     - Right Column (40% width): "Active Recall Study Queue"

3. COMPONENT DETAILS:
   - "Your Live Knowledge Graph" Panel:
     - Render a custom canvas element or force-directed network diagram using the JSON payload from Endpoint A.
     - Node formatting: Circle diameter proportional to topic size (use standard node size). Node background color maps to the node's `score` property:
       * score >= 0.7: Soft Green (#4caf50)
       * score >= 0.4 and < 0.7: Soft Amber/Orange (#ffb74d)
       * score < 0.4: Soft Red/Coral (#f44336)
     - Draw solid white connecting lines (opacity 0.4) for links, and dashed purple lines for prerequisite links.
     - Add hovering tooltip showing the topic name and its exact mastery percentage.
   - "Active Recall Study Queue" Panel:
     - Render a clean table or card list showing the output of Endpoint B.
     - Each item displays: Concept Name, Current Mastery %, and Last Reviewed Timestamp (formatted as relative time).
     - Include a small warning icon next to concepts with mastery < 40%.
     - Add a "Revise Now" button on each card which pops up a simple overlay showing a simulated flashcard question.

4. STYLE & THEME (Premium Aesthetics):
   - Background Color: #07080f
   - Card Backgrounds: #0c0f1d with thin border #202945
   - Text Colors: #ffffff (Primary), #90a4ae (Secondary)
   - Accent colors: Deep Purple (#7c4dff), Cyan (#00e5ff) for details
   - Add subtle drop shadows to cards.
```
