import os
import sys
import uuid
import requests
from database import get_driver, create_user_account, generate_token

# Define base URL
BASE_URL = "http://localhost:8000"

def main():
    print("Starting End-to-End Cross-Language Merge Integration Test...")

    # 1. Create a transient test user profile
    test_uid = f"test_user_{uuid.uuid4().hex[:6]}"
    test_username = f"user_{uuid.uuid4().hex[:6]}"
    test_name = "E2E Test Student"
    test_pwd = "password123"

    driver = get_driver()
    if not driver:
        print("ERROR: Neo4j database is offline. Cannot run integration tests.")
        sys.exit(1)

    print(f"Registering test user: {test_username}...")
    try:
        create_user_account(test_username, test_pwd, test_name, test_uid)
        token = generate_token(test_uid)
    except Exception as e:
        print(f"Failed to create test user account: {e}")
        sys.exit(1)

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }

    # 2. Post English Explanation (Photosynthesis)
    print("Posting English explanation of Photosynthesis...")
    payload_en = {
        "text": "Plants absorb carbon dioxide and water to produce glucose and release oxygen under sunlight.",
        "languageCode": "en-IN",
        "userId": test_uid,
        "userName": test_name,
        "commit": True
    }
    res_en = requests.post(f"{BASE_URL}/decks/generate", headers=headers, json=payload_en, timeout=30)
    if res_en.status_code != 201:
        print(f"ERROR: English generation failed with code {res_en.status_code}: {res_en.text}")
        sys.exit(1)
    
    deck_en = res_en.json()
    print("English deck generated successfully.")

    # 3. Post Hindi Explanation (प्रकाश संश्लेषण)
    print("Posting Hindi explanation of प्रकाश संश्लेषण...")
    payload_hi = {
        "text": "प्रकाश संश्लेषण वह प्रक्रिया है जिसमें हरे पौधे सूर्य के प्रकाश की उपस्थिति में कार्बन डाइऑक्साइड और जल से भोजन बनाते हैं।",
        "languageCode": "hi-IN",
        "userId": test_uid,
        "userName": test_name,
        "commit": True
    }
    res_hi = requests.post(f"{BASE_URL}/decks/generate", headers=headers, json=payload_hi, timeout=30)
    if res_hi.status_code != 201:
        print(f"ERROR: Hindi generation failed with code {res_hi.status_code}: {res_hi.text}")
        sys.exit(1)

    deck_hi = res_hi.json()
    print("Hindi deck generated successfully.")

    # 4. Assert both concepts map to same Topic canonical name "photosynthesis" in graph
    print("Verifying knowledge graph structure...")
    res_graph = requests.get(f"{BASE_URL}/users/{test_uid}/graph", headers=headers, timeout=10)
    if res_graph.status_code != 200:
        print(f"ERROR: Failed to fetch user graph: {res_graph.text}")
        sys.exit(1)

    graph = res_graph.json()
    nodes = graph.get("nodes", [])

    # Find the topic photosynthesis
    photo_topics = [n for n in nodes if n["label"].lower().strip() == "photosynthesis"]
    
    print("\nGraph Node analysis:")
    for n in nodes:
        print(f"- Node: '{n['label']}' (score: {n['score']})")

    if len(photo_topics) == 0:
        print("ERROR: Could not find canonical 'photosynthesis' topic node in graph.")
        sys.exit(1)
    elif len(photo_topics) > 1:
        print(f"ERROR: Cross-language merge failed! Found {len(photo_topics)} separate topic nodes for photosynthesis instead of 1.")
        sys.exit(1)

    # Verify concept counts via Neo4j directly
    with driver.session() as session:
        result = session.run(
            """
            MATCH (t:Topic {canonicalName: "photosynthesis"})<-[:INSTANCE_OF]-(c:Concept)
            RETURN c.id as conceptId, c.name as conceptName, c.language as lang
            """
        )
        concepts = list(result)
        print(f"\nConcepts attached to photosynthesis Topic:")
        for c in concepts:
            print(f"- Concept: '{c['conceptName']}' (Lang: {c['lang']})")

        if len(concepts) < 2:
            print("ERROR: Did not find both English and Hindi instances pointing to the photosynthesis topic node.")
            sys.exit(1)

    print("\nSUCCESS: End-to-end cross-language concept merge validated!")
    
    # 5. Clean up E2E test data
    print("Cleaning up test user details from database...")
    with driver.session() as session:
        session.run("MATCH (u:User {id: $uid}) DETACH DELETE u", uid=test_uid)
        session.run("MATCH (c:Concept) WHERE c.id STARTS WITH 'concept_photo_' DETACH DELETE c")

if __name__ == '__main__':
    main()
