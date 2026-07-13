// ============================================================================
// StudyBuddy Neo4j Graph Database Constraints & Queries
// ============================================================================

// 1. UNIQUE IDENTIFIER CONSTRAINTS
// ----------------------------------------------------------------------------
CREATE CONSTRAINT user_id_unique IF NOT EXISTS
FOR (u:User) REQUIRE u.id IS UNIQUE;

CREATE CONSTRAINT classroom_id_unique IF NOT EXISTS
FOR (c:Classroom) REQUIRE c.id IS UNIQUE;

CREATE CONSTRAINT topic_name_unique IF NOT EXISTS
FOR (t:Topic) REQUIRE t.canonicalName IS UNIQUE;

CREATE CONSTRAINT concept_id_unique IF NOT EXISTS
FOR (co:Concept) REQUIRE co.id IS UNIQUE;

CREATE CONSTRAINT deck_id_unique IF NOT EXISTS
FOR (d:Deck) REQUIRE d.id IS UNIQUE;


// 2. USEFUL DEVELOPMENT AND VERIFICATION QUERIES
// ----------------------------------------------------------------------------

// A. Check connectivity and list all node types/counts
MATCH (n) 
RETURN labels(n) as nodeType, count(*) as nodeCount;

// B. Show a student's personal graph (Topics and Relationships)
MATCH (u:User {id: "test-user-id"})-[:OWNS]->(d:Deck)-[:CONTAINS]->(c:Concept)-[:INSTANCE_OF]->(t:Topic)
WITH collect(t) as userTopics
UNWIND userTopics as t1
MATCH (t1)-[r:RELATES_TO|PREREQUISITE_OF]->(t2:Topic)
WHERE t2 IN userTopics
RETURN t1.canonicalName as Source, type(r) as Relationship, t2.canonicalName as Target;

// C. Verify Cross-Language concept merging
// Verify that multiple Concept nodes link to the same canonical Topic node
MATCH (t:Topic)<-[:INSTANCE_OF]-(c:Concept)
RETURN t.canonicalName as CanonicalTopic, collect({conceptName: c.name, language: c.language}) as RepresentedConcepts;

// D. Fetch Spaced-Repetition Review Queue
MATCH (u:User {id: "test-user-id"})-[l:LEARNED]->(t:Topic)
RETURN t.canonicalName as Topic, l.score as Score, l.lastReviewed as LastReviewed
ORDER BY l.lastReviewed ASC;

// E. Traversal: Prerequisite Next-To-Learn Suggestions
// Suggest topics that are prerequisites of topics the user has mastered (score >= 0.7) but hasn't studied yet
MATCH (u:User {id: "test-user-id"})-[l:LEARNED]->(t1:Topic)
WHERE l.score >= 0.7
MATCH (t1)-[:PREREQUISITE_OF]->(t2:Topic)
WHERE NOT (u)-[:LEARNED]->(t2)
RETURN DISTINCT t2.canonicalName as SuggestedTopic;

// F. Classroom Heatmap View (Aggregate & Anonymized)
MATCH (c:Classroom {id: "class-123"})<-[:MEMBER_OF]-(u:User)
OPTIONAL MATCH (u)-[l:LEARNED]->(t:Topic)
RETURN t.canonicalName as Topic, 
       avg(l.score) as AverageClassScore, 
       count(l) as NumberOfStudentsMastered,
       collect({studentAlias: "Student", score: l.score}) as StudentDetailBreakdowns;

// G. Classroom Leaderboard (Streak & Mastered Topics Count)
MATCH (c:Classroom {id: "class-123"})<-[:MEMBER_OF]-(u:User)
OPTIONAL MATCH (u)-[l:LEARNED]->(t:Topic)
WHERE l.score >= 0.7
RETURN u.name as StudentName, u.streak as StreakDays, count(t) as MasteredTopics
ORDER BY StreakDays DESC, MasteredTopics DESC;
