import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDecks, saveDeck } from './storage';

const API_URL_KEY = '@StudyBuddy:apiUrl';
const DEFAULT_API_URL = 'http://localhost:8000';

/**
 * Returns the current API URL.
 */
export const getApiUrl = async () => {
  try {
    const customUrl = await AsyncStorage.getItem(API_URL_KEY);
    return customUrl || process.env.EXPO_PUBLIC_WORKFLOW_API_URL || DEFAULT_API_URL;
  } catch {
    return process.env.EXPO_PUBLIC_WORKFLOW_API_URL || DEFAULT_API_URL;
  }
};

/**
 * Persists a custom API URL (e.g., ngrok link or Render URL).
 */
export const setApiUrl = async (url) => {
  try {
    await AsyncStorage.setItem(API_URL_KEY, url);
    return true;
  } catch {
    return false;
  }
};

/**
 * Builds request headers, attaching JWT bearer token if present.
 */
const getAuthHeaders = async () => {
  const token = await AsyncStorage.getItem('@StudyBuddy:token');
  const headers = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

/**
 * Generates fallback deck data offline.
 */
const getLocalHeuristicFallback = (text, languageCode) => {
  const normalized = text.toLowerCase();
  
  if (normalized.includes("photo") || normalized.includes("plant") || normalized.includes("प्रकाश") || normalized.includes("संश्लेषण") || normalized.includes("पौध")) {
    if (languageCode.startsWith("hi")) {
      return {
        deckId: `deck_fallback_${Date.now()}`,
        deckTitle: "प्रकाश संश्लेषण (Photosynthesis)",
        concepts: [
          {
            id: "photosynthesis",
            name: "प्रकाश संश्लेषण",
            language: "hi-IN",
            canonicalTopic: "photosynthesis",
            description: "वह प्रक्रिया जिसके द्वारा पौधे सूर्य के प्रकाश का उपयोग करके कार्बन डाइऑक्साइड और पानी से भोजन बनाते हैं।",
            relatesTo: ["chlorophyll"],
            prerequisiteOf: []
          },
          {
            id: "chlorophyll",
            name: "क्लोरोफिल",
            language: "hi-IN",
            canonicalTopic: "chlorophyll",
            description: "पौधों का हरा वर्णक जो प्रकाश संश्लेषण के लिए सौर ऊर्जा का अवशोषण करता है।",
            relatesTo: ["photosynthesis"],
            prerequisiteOf: []
          }
        ],
        cards: [
          {
            front: "प्रकाश संश्लेषण क्या है?",
            back: "वह प्रक्रिया जिसके द्वारा हरे पौधे सूर्य के प्रकाश का उपयोग करके भोजन बनाते हैं।",
            conceptId: "photosynthesis"
          },
          {
            front: "क्लोरोफिल का मुख्य कार्य क्या है?",
            back: "सूर्य के प्रकाश की ऊर्जा को अवशोषित करना जो प्रकाश संश्लेषण के लिए आवश्यक है।",
            conceptId: "chlorophyll"
          }
        ]
      };
    } else {
      return {
        deckId: `deck_fallback_${Date.now()}`,
        deckTitle: "Photosynthesis Basics",
        concepts: [
          {
            id: "photosynthesis",
            name: "Photosynthesis",
            language: "en-IN",
            canonicalTopic: "photosynthesis",
            description: "The process by which green plants use sunlight to synthesize nutrients from carbon dioxide and water.",
            relatesTo: ["chlorophyll"],
            prerequisiteOf: []
          },
          {
            id: "chlorophyll",
            name: "Chlorophyll",
            language: "en-IN",
            canonicalTopic: "chlorophyll",
            description: "The green pigment in plants that absorbs light energy for use in photosynthesis.",
            relatesTo: ["photosynthesis"],
            prerequisiteOf: []
          }
        ],
        cards: [
          {
            front: "What is Photosynthesis?",
            back: "The process by which green plants use sunlight to synthesize nutrients from carbon dioxide and water.",
            conceptId: "photosynthesis"
          },
          {
            front: "What is the role of Chlorophyll?",
            back: "It absorbs light energy (usually blue and red light) for use in photosynthesis.",
            conceptId: "chlorophyll"
          }
        ]
      };
    }
  } else if (normalized.includes("gravit") || normalized.includes("force") || normalized.includes("गुरुत्वाकर्षण") || normalized.includes("बल")) {
    if (languageCode.startsWith("hi")) {
      return {
        deckId: `deck_fallback_${Date.now()}`,
        deckTitle: "गुरुत्वाकर्षण (Gravity)",
        concepts: [
          {
            id: "gravity",
            name: "गुरुत्वाकर्षण",
            language: "hi-IN",
            canonicalTopic: "gravity",
            description: "ब्रह्मांड में किन्हीं भी दो वस्तुओं के बीच आकर्षण का बल जो उनके द्रव्यमान के कारण होता है।",
            relatesTo: [],
            prerequisiteOf: []
          }
        ],
        cards: [
          {
            front: "गुरुत्वाकर्षण बल क्या है?",
            back: "वह बल जो किन्हीं दो वस्तुओं को एक दूसरे की ओर आकर्षित करता है, जैसे पृथ्वी वस्तुओं को अपनी ओर खींचती है।",
            conceptId: "gravity"
          }
        ]
      };
    } else {
      return {
        deckId: `deck_fallback_${Date.now()}`,
        deckTitle: "Gravity and Motion",
        concepts: [
          {
            id: "gravity",
            name: "Gravity",
            language: "en-IN",
            canonicalTopic: "gravity",
            description: "The force that attracts a body toward the center of the earth, or toward any other physical body having mass.",
            relatesTo: [],
            prerequisiteOf: []
          }
        ],
        cards: [
          {
            front: "What is gravity?",
            back: "The force that attracts a body toward the center of the earth, or toward any other physical body having mass.",
            conceptId: "gravity"
          }
        ]
      };
    }
  } else {
    return {
      deckId: `deck_fallback_${Date.now()}`,
      deckTitle: "General Concepts",
      concepts: [
        {
          id: "general_learning",
          name: languageCode.startsWith("hi") ? "सक्रिय रिकॉल" : "Active Recall",
          language: languageCode,
          canonicalTopic: "active_recall",
          description: "A learning methodology where you actively prompt your memory rather than passively reading.",
          relatesTo: [],
          prerequisiteOf: []
        }
      ],
      cards: [
        {
          front: languageCode.startsWith("hi") ? "सक्रिय रिकॉल क्या है?" : "What is Active Recall?",
          back: languageCode.startsWith("hi") ? "जानकारी को स्मृति से सक्रिय रूप से याद करने की प्रक्रिया।" : "Retrieving information from memory rather than passively reading.",
          conceptId: "general_learning"
        }
      ]
    };
  }
};

/**
 * Triggers the remote deck generation workflow.
 * Falls back to offline heuristic client-side deck generation on error/timeout.
 */
export const generateDeck = async (userId, userName, text, audioBase64, languageCode, classroomId, commit = true) => {
  const baseUrl = await getApiUrl();
  console.log(`Sending generate request to: ${baseUrl}/decks/generate, commit=${commit}`);
  
  try {
    const response = await fetch(`${baseUrl}/decks/generate`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({
        text,
        audioBase64,
        languageCode,
        userId,
        userName,
        classroomId,
        commit,
      }),
    });
    
    if (response.ok) {
      const data = await response.json();
      if (commit) {
        await saveDeck(data);
      }
      return { data, isFallback: false };
    } else {
      const errText = await response.text();
      console.warn(`Server deck generation failed: ${errText}. Triggering offline fallback.`);
      const fallback = getLocalHeuristicFallback(text || "General study", languageCode);
      if (commit) {
        await saveDeck(fallback);
      }
      return { data: fallback, isFallback: true };
    }
  } catch (err) {
    console.warn(`Fetch error during generation: ${err.message}. Triggering offline fallback.`);
    const fallback = getLocalHeuristicFallback(text || "General study", languageCode);
    if (commit) {
      await saveDeck(fallback);
    }
    return { data: fallback, isFallback: true };
  }
};

/**
 * Commits a pre-extracted deck configuration to the graph.
 */
export const commitDeck = async (userId, userName, deckTitle, concepts, cards, classroomId) => {
  const baseUrl = await getApiUrl();
  const response = await fetch(`${baseUrl}/decks/commit`, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify({
      userId,
      userName,
      deckTitle,
      concepts,
      cards,
      classroomId,
    }),
  });
  if (response.ok) {
    const data = await response.json();
    await saveDeck(data);
    return data;
  } else {
    throw new Error(`Failed to commit deck to database`);
  }
};

/**
 * Triggers the remote Gemini-powered Auto-Learn workflow.
 */
export const autoLearnTopic = async (topic, userId, userName, classroomId) => {
  const baseUrl = await getApiUrl();
  console.log(`Sending auto-learn request to: ${baseUrl}/topics/learn`);
  
  try {
    const response = await fetch(`${baseUrl}/topics/learn`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({
        topic,
        userId,
        userName,
        classroomId,
      }),
    });
    
    if (response.ok) {
      const data = await response.json();
      await saveDeck(data);
      return { data, isFallback: false };
    } else {
      const errText = await response.text();
      console.warn(`Server auto-learn failed: ${errText}. Triggering offline fallback.`);
      const fallback = getLocalHeuristicFallback(topic, "en-IN");
      await saveDeck(fallback);
      return { data: fallback, isFallback: true };
    }
  } catch (err) {
    console.warn(`Fetch error during auto-learn: ${err.message}. Triggering offline fallback.`);
    const fallback = getLocalHeuristicFallback(topic, "en-IN");
    await saveDeck(fallback);
    return { data: fallback, isFallback: true };
  }
};

/**
 * Fetches the user's concept knowledge graph.
 */
export const getUserGraph = async (userId) => {
  const baseUrl = await getApiUrl();
  const response = await fetch(`${baseUrl}/users/${userId}/graph`, {
    headers: await getAuthHeaders(),
  });
  if (response.ok) {
    return await response.json();
  } else {
    throw new Error(`Failed to fetch graph from server (status ${response.status})`);
  }
};

/**
 * Updates mastery score for a topic.
 */
export const updateMastery = async (userId, topicId, score) => {
  const baseUrl = await getApiUrl();
  const response = await fetch(`${baseUrl}/users/${userId}/mastery`, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify({ topicId, score }),
  });
  if (response.ok) {
    return await response.json();
  } else {
    throw new Error(`Failed to update mastery on server`);
  }
};

/**
 * Fetches review queue.
 */
export const getReviewQueue = async (userId) => {
  const baseUrl = await getApiUrl();
  const response = await fetch(`${baseUrl}/users/${userId}/review-queue`, {
    headers: await getAuthHeaders(),
  });
  if (response.ok) {
    return await response.json();
  } else {
    throw new Error(`Failed to fetch review queue`);
  }
};

/**
 * Fetches suggestions for next-to-learn.
 */
export const getNextToLearn = async (userId) => {
  const baseUrl = await getApiUrl();
  const response = await fetch(`${baseUrl}/users/${userId}/next-to-learn`, {
    headers: await getAuthHeaders(),
  });
  if (response.ok) {
    return await response.json();
  } else {
    throw new Error(`Failed to fetch next-to-learn suggestions`);
  }
};

/**
 * Join classroom.
 */
export const joinClassroom = async (userId, classroomId) => {
  const baseUrl = await getApiUrl();
  const response = await fetch(`${baseUrl}/classrooms/${classroomId}/join`, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify({ userId }),
  });
  if (response.ok) {
    return await response.json();
  } else {
    throw new Error(`Failed to join classroom`);
  }
};

/**
 * Fetch leaderboard.
 */
export const getLeaderboard = async (classroomId) => {
  const baseUrl = await getApiUrl();
  const response = await fetch(`${baseUrl}/classrooms/${classroomId}/leaderboard`, {
    headers: await getAuthHeaders(),
  });
  if (response.ok) {
    return await response.json();
  } else {
    throw new Error(`Failed to fetch leaderboard`);
  }
};

/**
 * Register a user profile.
 */
export const registerUser = async (username, password, name) => {
  const baseUrl = await getApiUrl();
  const response = await fetch(`${baseUrl}/users/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, name }),
  });
  if (response.ok) {
    const result = await response.json();
    if (result.token) {
      await AsyncStorage.setItem('@StudyBuddy:token', result.token);
    }
    return result;
  } else {
    const errorMsg = await response.text();
    let detail = "Registration failed";
    try {
      const parsed = JSON.parse(errorMsg);
      detail = parsed.detail || detail;
    } catch(e) {}
    throw new Error(detail);
  }
};

/**
 * Login a user profile.
 */
export const loginUser = async (username, password) => {
  const baseUrl = await getApiUrl();
  const response = await fetch(`${baseUrl}/users/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (response.ok) {
    const result = await response.json();
    if (result.token) {
      await AsyncStorage.setItem('@StudyBuddy:token', result.token);
    }
    return result;
  } else {
    const errorMsg = await response.text();
    let detail = "Invalid username or password";
    try {
      const parsed = JSON.parse(errorMsg);
      detail = parsed.detail || detail;
    } catch(e) {}
    throw new Error(detail);
  }
};

/**
 * Grade student's free-text response against the flashcard answer.
 */
export const gradeAnswer = async (question, correctAnswer, studentAnswer) => {
  const baseUrl = await getApiUrl();
  const response = await fetch(`${baseUrl}/grade`, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify({ question, correctAnswer, studentAnswer }),
  });
  if (response.ok) {
    return await response.json();
  } else {
    throw new Error(`Failed to grade answer on server`);
  }
};

/**
 * Batch updates mastery scores for multiple topics.
 */
export const updateMasteryBatch = async (userId, updates) => {
  const baseUrl = await getApiUrl();
  const response = await fetch(`${baseUrl}/users/${userId}/mastery/batch`, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify({ updates }),
  });
  if (response.ok) {
    return await response.json();
  } else {
    throw new Error(`Failed to update masteries in batch`);
  }
};

