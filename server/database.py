import os
import uuid
import hashlib
from datetime import datetime
from neo4j import GraphDatabase, basic_auth
from dotenv import load_dotenv

dotenv_path = os.path.join(os.path.dirname(__file__), '.env')
load_dotenv(dotenv_path, override=True)

NEO4J_URI = os.getenv("NEO4J_URI", "bolt://localhost:7687")
NEO4J_USERNAME = os.getenv("NEO4J_USERNAME", "neo4j")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD", "password")

_driver = None

def init_driver():
    global _driver
    if _driver is None:
        try:
            print(f"Connecting to Neo4j at {NEO4J_URI} using username '{NEO4J_USERNAME}' and password '{NEO4J_PASSWORD[:4]}...{NEO4J_PASSWORD[-4:]}'")
            _driver = GraphDatabase.driver(
                NEO4J_URI, 
                auth=basic_auth(NEO4J_USERNAME, NEO4J_PASSWORD)
            )
            # Verify connectivity
            _driver.verify_connectivity()
            print("Connected to Neo4j successfully!")
            create_constraints()
        except Exception as e:
            print(f"Failed to connect to Neo4j: {e}")
            _driver = None
    return _driver

def get_driver():
    global _driver
    if _driver is None:
        return init_driver()
    return _driver

def close_driver():
    global _driver
    if _driver is not None:
        _driver.close()
        _driver = None

def create_constraints():
    driver = get_driver()
    if not driver:
        return
    
    constraints = [
        "CREATE CONSTRAINT user_id_unique IF NOT EXISTS FOR (u:User) REQUIRE u.id IS UNIQUE",
        "CREATE CONSTRAINT user_username_unique IF NOT EXISTS FOR (u:User) REQUIRE u.username IS UNIQUE",
        "CREATE CONSTRAINT classroom_id_unique IF NOT EXISTS FOR (c:Classroom) REQUIRE c.id IS UNIQUE",
        "CREATE CONSTRAINT topic_name_unique IF NOT EXISTS FOR (t:Topic) REQUIRE t.canonicalName IS UNIQUE",
        "CREATE CONSTRAINT concept_id_unique IF NOT EXISTS FOR (c:Concept) REQUIRE c.id IS UNIQUE",
        "CREATE CONSTRAINT deck_id_unique IF NOT EXISTS FOR (d:Deck) REQUIRE d.id IS UNIQUE"
    ]
    
    with driver.session() as session:
        for constraint in constraints:
            try:
                session.run(constraint)
            except Exception as e:
                print(f"Error creating constraint: {e}")

def write_deck_and_graph(user_id, user_name, deck_title, concepts, cards, classroom_id=None):
    driver = get_driver()
    if not driver:
        raise Exception("Neo4j database driver is not initialized")
    
    deck_id = str(uuid.uuid4())
    created_at = datetime.utcnow().isoformat()
    
    query = """
    MERGE (u:User {id: $user_id})
    ON CREATE SET u.name = $user_name, u.streak = 0
    ON MATCH SET u.name = $user_name
    
    CREATE (d:Deck {id: $deck_id, title: $deck_title, createdAt: $created_at})
    CREATE (u)-[:OWNS]->(d)
    
    WITH u, d
    """
    
    # Process concepts and cards in the session
    with driver.session() as session:
        # 1. Create Deck and User
        session.run(
            """
            MERGE (u:User {id: $user_id})
            ON CREATE SET u.name = $user_name, u.streak = 0
            ON MATCH SET u.name = $user_name
            
            MERGE (d:Deck {id: $deck_id})
            SET d.title = $deck_title, d.createdAt = $created_at
            
            MERGE (u)-[:OWNS]->(d)
            """,
            user_id=user_id,
            user_name=user_name,
            deck_id=deck_id,
            deck_title=deck_title,
            created_at=created_at
        )
        
        # If classroom_id, associate user and deck with Classroom
        if classroom_id:
            session.run(
                """
                MERGE (c:Classroom {id: $classroom_id})
                MERGE (u:User {id: $user_id})
                MERGE (u)-[:MEMBER_OF]->(c)
                """,
                classroom_id=classroom_id,
                user_id=user_id
            )
            
        # 2. Create Concept and Topic nodes, and their connections
        for c in concepts:
            c_id = c.get("id", str(uuid.uuid4()))
            name = c.get("name", "")
            lang = c.get("language", "en-IN")
            canonical = c.get("canonicalTopic", "").strip().lower()
            if not canonical:
                canonical = name.strip().lower()
                
            # Create Topic and Concept
            session.run(
                """
                MERGE (t:Topic {canonicalName: $canonical})
                ON CREATE SET t.id = $topic_uuid
                
                MERGE (co:Concept {id: $c_id})
                SET co.name = $name, co.language = $lang, co.description = $description
                
                MERGE (co)-[:INSTANCE_OF]->(t)
                
                WITH co
                MATCH (d:Deck {id: $deck_id})
                MERGE (d)-[:CONTAINS]->(co)
                """,
                canonical=canonical,
                topic_uuid=str(uuid.uuid4()),
                c_id=c_id,
                name=name,
                lang=lang,
                description=c.get("description", "A key concept representing a building block of knowledge."),
                deck_id=deck_id
            )
            
            # Draw relationships between Topics
            for rel in c.get("relatesTo", []):
                rel_canonical = rel.strip().lower()
                if rel_canonical:
                    session.run(
                        """
                        MERGE (t1:Topic {canonicalName: $canonical})
                        ON CREATE SET t1.id = $t1_uuid
                        MERGE (t2:Topic {canonicalName: $rel_canonical})
                        ON CREATE SET t2.id = $t2_uuid
                        MERGE (t1)-[:RELATES_TO]->(t2)
                        """,
                        canonical=canonical,
                        t1_uuid=str(uuid.uuid4()),
                        rel_canonical=rel_canonical,
                        t2_uuid=str(uuid.uuid4())
                    )
                    
            for prereq in c.get("prerequisiteOf", []):
                prereq_canonical = prereq.strip().lower()
                if prereq_canonical:
                    session.run(
                        """
                        MERGE (t1:Topic {canonicalName: $canonical})
                        ON CREATE SET t1.id = $t1_uuid
                        MERGE (t2:Topic {canonicalName: $prereq_canonical})
                        ON CREATE SET t2.id = $t2_uuid
                        MERGE (t1)-[:PREREQUISITE_OF]->(t2)
                        """,
                        canonical=canonical,
                        t1_uuid=str(uuid.uuid4()),
                        prereq_canonical=prereq_canonical,
                        t2_uuid=str(uuid.uuid4())
                    )
                    
    return {
        "deckId": deck_id,
        "title": deck_title,
        "createdAt": created_at,
        "cards": cards,
        "concepts": concepts
    }

def get_user_graph(user_id):
    driver = get_driver()
    if not driver:
        # Mock empty graph response if Neo4j is offline
        return {"nodes": [], "edges": []}
        
    with driver.session() as session:
        # Get topics studied by this user
        nodes_result = session.run(
            """
            MATCH (u:User {id: $user_id})-[:OWNS]->(d:Deck)-[:CONTAINS]->(c:Concept)-[:INSTANCE_OF]->(t:Topic)
            OPTIONAL MATCH (u)-[l:LEARNED]->(t)
            RETURN DISTINCT t.id as id, t.canonicalName as canonicalName, l.score as score, c.description as description
            """,
            user_id=user_id
        )
        nodes = []
        node_names = set()
        for record in nodes_result:
            name = record["canonicalName"]
            node_names.add(name)
            nodes.append({
                "id": record["id"] or name,
                "label": name,
                "score": record["score"] or 0.0,
                "description": record["description"] or "A key concept representing a building block of knowledge."
            })
            
        # Get relationships between those topics
        edges_result = session.run(
            """
            MATCH (t1:Topic)-[r:RELATES_TO|PREREQUISITE_OF]->(t2:Topic)
            WHERE t1.canonicalName IN $node_names AND t2.canonicalName IN $node_names
            RETURN DISTINCT t1.id as sourceId, t1.canonicalName as sourceName, 
                            t2.id as targetId, t2.canonicalName as targetName, 
                            type(r) as type
            """,
            node_names=list(node_names)
        )
        edges = []
        for record in edges_result:
            edges.append({
                "source": record["sourceId"] or record["sourceName"],
                "target": record["targetId"] or record["targetName"],
                "type": record["type"]
            })
            
        return {"nodes": nodes, "edges": edges}

def get_review_queue(user_id):
    driver = get_driver()
    if not driver:
        return []
        
    with driver.session() as session:
        result = session.run(
            """
            MATCH (u:User {id: $user_id})-[l:LEARNED]->(t:Topic)
            RETURN t.id as id, t.canonicalName as name, l.score as score, l.lastReviewed as lastReviewed
            ORDER BY l.lastReviewed ASC
            """,
            user_id=user_id
        )
        return [
            {
                "id": r["id"] or r["name"],
                "name": r["name"],
                "score": r["score"],
                "lastReviewed": r["lastReviewed"]
            }
            for r in result
        ]

def hash_password(password: str) -> str:
    """Computes SHA-256 hash of password for secure storage."""
    return hashlib.sha256(password.encode('utf-8')).hexdigest()

def create_user_account(username, password, name):
    """Registers a unique user profile in Neo4j with hashed credentials."""
    driver = get_driver()
    if not driver:
        raise Exception("Database connection offline")
        
    user_id = f"usr_{str(uuid.uuid4())[:8].upper()}"
    pwd_hash = hash_password(password)
    username_clean = username.strip().lower()
    
    with driver.session() as session:
        # First verify uniqueness of username
        existing = session.run(
            "MATCH (u:User {username: $username}) RETURN u.id LIMIT 1",
            username=username_clean
        ).single()
        if existing:
            raise Exception("Username already exists")
            
        session.run(
            """
            CREATE (u:User {
                id: $user_id, 
                username: $username, 
                passwordHash: $password_hash, 
                name: $name, 
                streak: 0
            })
            """,
            user_id=user_id,
            username=username_clean,
            password_hash=pwd_hash,
            name=name
        )
        return {"id": user_id, "username": username_clean, "name": name, "streak": 0}

def login_user_account(username, password):
    """Validates user password hash and returns details on success."""
    driver = get_driver()
    if not driver:
        raise Exception("Database connection offline")
        
    pwd_hash = hash_password(password)
    username_clean = username.strip().lower()
    
    with driver.session() as session:
        result = session.run(
            """
            MATCH (u:User {username: $username})
            RETURN u.id as id, u.name as name, u.passwordHash as passwordHash, u.streak as streak
            """,
            username=username_clean
        ).single()
        
        if not result:
            raise Exception("Account username not found")
            
        if result["passwordHash"] != pwd_hash:
            raise Exception("Invalid username or password")
            
        return {
            "id": result["id"],
            "username": username_clean,
            "name": result["name"],
            "streak": result["streak"] or 0
        }

def get_next_to_learn(user_id):
    driver = get_driver()
    if not driver:
        return []
        
    with driver.session() as session:
        result = session.run(
            """
            MATCH (u:User {id: $user_id})-[l:LEARNED]->(t1:Topic)
            WHERE l.score >= 0.7
            MATCH (t1)-[:PREREQUISITE_OF]->(t2:Topic)
            WHERE NOT (u)-[:LEARNED]->(t2)
            RETURN DISTINCT t2.id as id, t2.canonicalName as name
            LIMIT 5
            """,
            user_id=user_id
        )
        return [
            {
                "id": r["id"] or r["name"],
                "name": r["name"]
            }
            for r in result
        ]

def update_mastery(user_id, topic_id, score):
    driver = get_driver()
    if not driver:
        return {"status": "offline_mode_success"}
        
    now = datetime.utcnow().isoformat()
    with driver.session() as session:
        # Match topic by id OR canonicalName
        session.run(
            """
            MERGE (u:User {id: $user_id})
            ON CREATE SET u.streak = 0
            
            MATCH (t:Topic)
            WHERE t.id = $topic_id OR t.canonicalName = $topic_id
            
            MERGE (u)-[l:LEARNED]->(t)
            SET l.score = $score, l.lastReviewed = $now
            
            WITH u, l
            SET u.streak = CASE WHEN $score >= 0.7 THEN u.streak + 1 ELSE 0 END
            """,
            user_id=user_id,
            topic_id=topic_id,
            score=score,
            now=now
        )
        return {"status": "success", "topicId": topic_id, "score": score}

def get_classroom_heatmap(classroom_id):
    driver = get_driver()
    if not driver:
        return {"classroom": classroom_id, "topics": []}
        
    with driver.session() as session:
        # 1. Fetch class topics and student details
        result = session.run(
            """
            MATCH (c:Classroom {id: $classroom_id})<-[:MEMBER_OF]-(u:User)
            WITH count(u) as classSize, collect(u) as students
            UNWIND students as u
            OPTIONAL MATCH (u)-[l:LEARNED]->(t:Topic)
            WHERE t IS NOT NULL
            RETURN t.id as topicId, t.canonicalName as name, 
                   avg(l.score) as averageScore, 
                   count(l) as masteredCount,
                   collect({studentId: u.id, score: l.score}) as studentData
            """,
            classroom_id=classroom_id
        )
        
        heatmap_topics = []
        for r in result:
            if not r["topicId"]:
                continue
                
            # Anonymize student details
            anonymized = []
            for idx, item in enumerate(r["studentData"]):
                score = item.get("score")
                anonymized.append({
                    "studentAlias": f"Student {idx + 1}",
                    "score": score if score is not None else 0.0
                })
                
            heatmap_topics.append({
                "topicId": r["topicId"],
                "name": r["name"],
                "averageScore": r["averageScore"] or 0.0,
                "masteredCount": r["masteredCount"],
                "students": anonymized
            })
            
        return {
            "classroom": classroom_id,
            "topics": heatmap_topics
        }

def get_classroom_leaderboard(classroom_id):
    driver = get_driver()
    if not driver:
        return []
        
    with driver.session() as session:
        result = session.run(
            """
            MATCH (c:Classroom {id: $classroom_id})<-[:MEMBER_OF]-(u:User)
            OPTIONAL MATCH (u)-[l:LEARNED]->(t:Topic)
            WHERE l.score >= 0.7
            RETURN u.id as userId, u.name as userName, 
                   u.streak as streak, count(t) as masteredCount
            ORDER BY u.streak DESC, masteredCount DESC
            """,
            classroom_id=classroom_id
        )
        
        return [
            {
                "userId": r["userId"],
                "userName": r["userName"] or "Anonymous Student",
                "streak": r["streak"] or 0,
                "masteredCount": r["masteredCount"] or 0
            }
            for r in result
        ]

def join_classroom(user_id, classroom_id):
    driver = get_driver()
    if not driver:
        return {"status": "success", "classroomId": classroom_id}
        
    with driver.session() as session:
        session.run(
            """
            MERGE (c:Classroom {id: $classroom_id})
            ON CREATE SET c.name = $class_name
            
            MERGE (u:User {id: $user_id})
            MERGE (u)-[:MEMBER_OF]->(c)
            """,
            user_id=user_id,
            classroom_id=classroom_id,
            class_name=f"Classroom {classroom_id}"
        )
        return {"status": "success", "classroomId": classroom_id}
