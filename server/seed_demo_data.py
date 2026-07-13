import os
import sys
import uuid
import argparse
from datetime import datetime, timedelta, timezone
from neo4j import GraphDatabase, basic_auth
from dotenv import load_dotenv
import bcrypt

# Load environment
dotenv_path = os.path.join(os.path.dirname(__file__), '.env')
load_dotenv(dotenv_path, override=True)

NEO4J_URI = os.getenv("NEO4J_URI")
NEO4J_USERNAME = os.getenv("NEO4J_USERNAME")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD")

def get_driver():
    if not NEO4J_URI or not NEO4J_USERNAME or not NEO4J_PASSWORD:
        return None
    try:
        return GraphDatabase.driver(
            NEO4J_URI, 
            auth=basic_auth(NEO4J_USERNAME, NEO4J_PASSWORD)
        )
    except Exception as e:
        print(f"Driver connection failed: {e}")
        return None

def main():
    parser = argparse.ArgumentParser(description="Seed StudyBuddy database with demo data.")
    parser.add_argument('--confirm', action='store_true', help="Required flag to execute seeding.")
    args = parser.parse_args()

    if not args.confirm:
        print("ERROR: Safety Guard triggered.")
        print("To seed the database, you must run this script with: python server/seed_demo_data.py --confirm")
        sys.exit(1)

    driver = get_driver()
    if not driver:
        print("ERROR: Neo4j database credentials not found in env.")
        sys.exit(1)

    print("Purging existing database...")
    with driver.session() as session:
        session.run("MATCH (n) DETACH DELETE n")

    print("Seeding database...")
    
    # 1. User Hashed Passwords
    password_hash = bcrypt.hashpw(b"sih_pass_2026", bcrypt.gensalt()).decode('utf-8')
    
    # Time settings
    now = datetime.now(timezone.utc).isoformat()
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    yesterday = (datetime.now(timezone.utc) - timedelta(days=1)).strftime("%Y-%m-%d")
    two_days_ago = (datetime.now(timezone.utc) - timedelta(days=2)).strftime("%Y-%m-%d")

    with driver.session() as session:
        # 2. Seed Users
        users = [
            {"id": "usr_alice", "username": "alice", "password": password_hash, "name": "Alice Smith", "streak": 3, "lastSessionDate": yesterday},
            {"id": "usr_bob", "username": "bob", "password": password_hash, "name": "Bob Kumar", "streak": 5, "lastSessionDate": today},
            {"id": "usr_charlie", "username": "charlie", "password": password_hash, "name": "Charlie Brown", "streak": 1, "lastSessionDate": two_days_ago}
        ]
        for u in users:
            session.run(
                """
                CREATE (u:User {
                    id: $id, 
                    username: $username, 
                    password: $password, 
                    name: $name, 
                    streak: $streak, 
                    lastSessionDate: $lastSessionDate
                })
                """,
                **u
            )
        print("Seeded Users: Alice, Bob, Charlie.")

        # 3. Seed Classroom
        session.run(
            """
            CREATE (c:Classroom {id: "class_sih2026", name: "Class SIH 2026"})
            """
        )
        print("Seeded Classroom: class_sih2026.")

        # 4. Associate Users with Classroom
        session.run(
            """
            MATCH (c:Classroom {id: "class_sih2026"}), (u:User)
            CREATE (u)-[:MEMBER_OF]->(c)
            """
        )

        # 5. Create Topic Nodes
        topics = [
            {"id": "topic_photo", "canonical": "photosynthesis"},
            {"id": "topic_chloro", "canonical": "chlorophyll"},
            {"id": "topic_grav", "canonical": "gravity"},
            {"id": "topic_orbit", "canonical": "orbits"}
        ]
        for t in topics:
            session.run(
                """
                CREATE (tp:Topic {id: $id, canonicalName: $canonical})
                """,
                **t
            )
        print("Seeded Topics: photosynthesis, chlorophyll, gravity, orbits.")

        # 6. Draw Prerequisite and Related Edges between Topics (with weights)
        session.run(
            """
            MATCH (tp:Topic {canonicalName: "chlorophyll"}), (t2:Topic {canonicalName: "photosynthesis"})
            CREATE (tp)-[:RELATES_TO {weight: 2}]->(t2)
            """
        )
        session.run(
            """
            MATCH (tp:Topic {canonicalName: "gravity"}), (t2:Topic {canonicalName: "orbits"})
            CREATE (tp)-[:PREREQUISITE_OF {weight: 3}]->(t2)
            """
        )

        # 7. Create Decks, Concepts, and Cards
        # Alice's English photosynthesis deck
        deck_alice_id = str(uuid.uuid4())
        session.run(
            """
            MATCH (u:User {id: "usr_alice"})
            CREATE (d:Deck {id: $deck_id, title: "Photosynthesis & Plant Biology", createdAt: $now})
            CREATE (u)-[:OWNS]->(d)
            
            CREATE (c1:Concept {
                id: "concept_photo_en", 
                name: "Photosynthesis", 
                language: "en-IN", 
                description: "Process by which green plants synthesize nutrients using sunlight, water, and carbon dioxide."
            })
            CREATE (c2:Concept {
                id: "concept_chloro_en", 
                name: "Chlorophyll", 
                language: "en-IN", 
                description: "The green pigment in chloroplasts that absorbs light energy for photosynthesis."
            })
            
            CREATE (d)-[:CONTAINS]->(c1)
            CREATE (d)-[:CONTAINS]->(c2)
            
            WITH c1, c2
            MATCH (t_photo:Topic {canonicalName: "photosynthesis"})
            MATCH (t_chloro:Topic {canonicalName: "chlorophyll"})
            
            CREATE (c1)-[:INSTANCE_OF]->(t_photo)
            CREATE (c2)-[:INSTANCE_OF]->(t_chloro)
            """,
            deck_id=deck_alice_id,
            now=now
        )

        # Bob's Hindi photosynthesis deck
        deck_bob_id = str(uuid.uuid4())
        session.run(
            """
            MATCH (u:User {id: "usr_bob"})
            CREATE (d:Deck {id: $deck_id, title: "प्रकाश संश्लेषण बुनियादी बातें", createdAt: $now})
            CREATE (u)-[:OWNS]->(d)
            
            CREATE (c1:Concept {
                id: "concept_photo_hi", 
                name: "प्रकाश संश्लेषण", 
                language: "hi-IN", 
                description: "पौधों द्वारा सूर्य के प्रकाश, जल और कार्बन डाइऑक्साइड की उपस्थिति में भोजन बनाने की प्रक्रिया।"
            })
            CREATE (c2:Concept {
                id: "concept_chloro_hi", 
                name: "क्लोरोफिल", 
                language: "hi-IN", 
                description: "पौधों में मौजूद हरा वर्णक जो सौर ऊर्जा को अवशोषित करता है।"
            })
            
            CREATE (d)-[:CONTAINS]->(c1)
            CREATE (d)-[:CONTAINS]->(c2)
            
            WITH c1, c2
            MATCH (t_photo:Topic {canonicalName: "photosynthesis"})
            MATCH (t_chloro:Topic {canonicalName: "chlorophyll"})
            
            CREATE (c1)-[:INSTANCE_OF]->(t_photo)
            CREATE (c2)-[:INSTANCE_OF]->(t_chloro)
            """,
            deck_id=deck_bob_id,
            now=now
        )

        # Charlie's Gravity deck
        deck_charlie_id = str(uuid.uuid4())
        session.run(
            """
            MATCH (u:User {id: "usr_charlie"})
            CREATE (d:Deck {id: $deck_id, title: "Gravity Basics", createdAt: $now})
            CREATE (u)-[:OWNS]->(d)
            
            CREATE (c1:Concept {
                id: "concept_gravity_en", 
                name: "Gravity", 
                language: "en-IN", 
                description: "The universal attraction force between physical bodies proportional to their masses."
            })
            
            CREATE (d)-[:CONTAINS]->(c1)
            
            WITH c1
            MATCH (t_grav:Topic {canonicalName: "gravity"})
            CREATE (c1)-[:INSTANCE_OF]->(t_grav)
            """,
            deck_id=deck_charlie_id,
            now=now
        )
        print("Seeded Concept nodes pointing to canonical Topic nodes (validating multi-lingual merge!).")

        # 8. Seed Spaced-Repetition Mastery Logs (LEARNED relationships)
        # Alice mastered photosynthesis and chlorophyll
        session.run(
            """
            MATCH (u:User {id: "usr_alice"})
            MATCH (t1:Topic {canonicalName: "photosynthesis"})
            MATCH (t2:Topic {canonicalName: "chlorophyll"})
            
            CREATE (u)-[:LEARNED {
                score: 0.8, 
                interval: 6, 
                easeFactor: 2.5, 
                lastReviewed: $now, 
                nextReviewDate: date() + duration({days: 6})
            }]->(t1)
            
            CREATE (u)-[:LEARNED {
                score: 0.9, 
                interval: 8, 
                easeFactor: 2.6, 
                lastReviewed: $now, 
                nextReviewDate: date() + duration({days: 8})
            }]->(t2)
            """,
            now=now
        )

        # Bob mastered photosynthesis, struggled with chlorophyll
        session.run(
            """
            MATCH (u:User {id: "usr_bob"})
            MATCH (t1:Topic {canonicalName: "photosynthesis"})
            MATCH (t2:Topic {canonicalName: "chlorophyll"})
            
            CREATE (u)-[:LEARNED {
                score: 0.85, 
                interval: 6, 
                easeFactor: 2.5, 
                lastReviewed: $now, 
                nextReviewDate: date() + duration({days: 6})
            }]->(t1)
            
            CREATE (u)-[:LEARNED {
                score: 0.5, 
                interval: 1, 
                easeFactor: 2.1, 
                lastReviewed: $now, 
                nextReviewDate: date()
            }]->(t2)
            """,
            now=now
        )

        # Charlie mastered gravity (making orbits due to learn)
        session.run(
            """
            MATCH (u:User {id: "usr_charlie"})
            MATCH (t:Topic {canonicalName: "gravity"})
            
            CREATE (u)-[:LEARNED {
                score: 0.95, 
                interval: 10, 
                easeFactor: 2.7, 
                lastReviewed: $now, 
                nextReviewDate: date() + duration({days: 10})
            }]->(t)
            """,
            now=now
        )
        print("Seeded spaced repetition LEARNED states and user streaks.")
        print("Database seeded successfully with demo details!")

    driver.close()

if __name__ == '__main__':
    main()
