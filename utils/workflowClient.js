import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDecks, saveDeck } from './storage';

const API_URL_KEY = '@StudyBuddy:apiUrl';
const DEFAULT_API_URL = 'http://localhost:8000'; // Default local address

/**
 * Returns the current API URL.
 */
export const getApiUrl = async () => {
  try {
    const customUrl = await AsyncStorage.getItem(API_URL_KEY);
    return customUrl || DEFAULT_API_URL;
  } catch {
    return DEFAULT_API_URL;
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
 * Triggers the remote deck generation workflow.
 * Falls back to offline heuristic client-side deck generation on error/timeout.
 */
export const generateDeck = async (userId, userName, text, audioBase64, languageCode, classroomId) => {
  const baseUrl = await getApiUrl();
  console.log(`Sending generate request to: ${baseUrl}/decks/generate`);
  
  const response = await fetch(`${baseUrl}/decks/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text,
      audioBase64,
      languageCode,
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
    throw new Error(`Server returned error status ${response.status}: ${errText}`);
  }
};

/**
 * Triggers the remote Gemini-powered Auto-Learn workflow.
 */
export const autoLearnTopic = async (topic, userId, userName, classroomId) => {
  const baseUrl = await getApiUrl();
  console.log(`Sending auto-learn request to: ${baseUrl}/topics/learn`);
  
  const response = await fetch(`${baseUrl}/topics/learn`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
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
    throw new Error(`Server returned error status ${response.status}: ${errText}`);
  }
};

/**
 * Fetches the user's concept knowledge graph.
 */
export const getUserGraph = async (userId) => {
  const baseUrl = await getApiUrl();
  const response = await fetch(`${baseUrl}/users/${userId}/graph`);
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
    headers: { 'Content-Type': 'application/json' },
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
  const response = await fetch(`${baseUrl}/users/${userId}/review-queue`);
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
  const response = await fetch(`${baseUrl}/users/${userId}/next-to-learn`);
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
    headers: { 'Content-Type': 'application/json' },
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
  const response = await fetch(`${baseUrl}/classrooms/${classroomId}/leaderboard`);
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
    return await response.json();
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
    return await response.json();
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
