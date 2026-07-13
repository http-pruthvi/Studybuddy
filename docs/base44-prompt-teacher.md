# Base44 Builder Prompt: Classroom Teacher Heat Map Dashboard

Copy and paste the prompt below into the Base44 dashboard builder chat to automatically generate the teacher analytics portal.

---

### BASE44 BUILDER PROMPT:

```text
Build a responsive classroom learning analytics dashboard for teachers with a clean dark theme, meeting the following specifications:

1. INTEGRATION CONFIGURATION:
   - Configure a REST integration targeting the StudyBuddy server API.
   - Endpoint: GET `/classrooms/{classroomId}/heatmap` to retrieve classroom topic statistics and student details.
   - Add a classroom code text input field in the page header for `{classroomId}` (default placeholder: "class_sih2026") which refreshes dashboard components.

2. PAGE LAYOUT:
   - Header: Dark navigation bar. Show the app name "StudyBuddy Teacher Dashboard" and a green secure badge.
   - Three main visual areas:
     - Top Summary Metrics: Total class topics, Average class-wide mastery %, and Number of weak concepts (average score < 50%).
     - Left Column (50% width): "Classroom Concept Mastery Heat Map"
     - Right Column (50% width): "Anonymized Student Progress Breakdown"

3. COMPONENT DETAILS:
   - "Classroom Concept Mastery Heat Map":
     - Render a grid of cards (a heat map grid) where each card represents a topic node from the endpoint's `topics` array.
     - Color each card dynamically based on its `averageScore` property:
       * averageScore >= 0.75: Deep Forest Green (#1b5e20)
       * averageScore >= 0.50 and < 0.75: Medium Orange/Amber (#e65100)
       * averageScore < 0.50: Deep Red/Crimson (#b71c1c)
     - Display the Topic name and the exact average class percentage on the card.
     - Clicking a topic card highlights and filters the student breakdown table on the right.
   - "Anonymized Student Progress Breakdown":
     - Displays a details table showing the anonymized student progress records (`students` array) for the currently selected/clicked topic.
     - Columns: Student Alias (e.g. "Student 1", "Student 2"), Mastery Score, Status (Green check if score >= 0.7, Red alert if score < 0.4).
     - Under GDPR / civic privacy compliance rules, do not show any real names, emails, or personal identifiers.

4. STYLE & THEME (Premium Aesthetics):
   - Background Color: #07080f
   - Card Backgrounds: #0c0f1d with thin border #202945
   - Table headers: #111424
   - Accent colors: Violet (#7c4dff), Cyan (#00e5ff)
   - Ensure clear labels explaining that student progress is stored server-side and only anonymized aliases are exposed to this dashboard.
```
