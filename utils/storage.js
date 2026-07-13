import AsyncStorage from '@react-native-async-storage/async-storage';

const USER_KEY = '@StudyBuddy:user';
const DECKS_KEY = '@StudyBuddy:decks';
const CLASSROOM_KEY = '@StudyBuddy:classroomId';
const MOOD_KEY = '@StudyBuddy:mood';

// Helper to generate a random 4-char string
const generateHash = () => Math.random().toString(36).substring(2, 6).toUpperCase();

/**
 * Initializes user profile locally with a persistent UUID and screen name.
 */
export const initUser = async () => {
  try {
    const existing = await AsyncStorage.getItem(USER_KEY);
    if (existing) {
      return JSON.parse(existing);
    }
    
    // Generate new user details
    const newUser = {
      id: `usr_${generateHash()}_${Date.now().toString().slice(-4)}`,
      name: `Learner ${generateHash()}`,
      streak: 0
    };
    
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(newUser));
    return newUser;
  } catch (err) {
    console.error('Error initializing user:', err);
    throw err;
  }
};

/**
 * Retrieves the current local user details.
 */
export const getUser = async () => {
  try {
    const user = await AsyncStorage.getItem(USER_KEY);
    return user ? JSON.parse(user) : null;
  } catch (err) {
    console.error('Error fetching user:', err);
    return null;
  }
};

/**
 * Saves/updates user details.
 */
export const saveUser = async (user) => {
  try {
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
    return user;
  } catch (err) {
    console.error('Error saving user:', err);
    return null;
  }
};

/**
 * Logs out the current user and clears session storage.
 */
export const logoutUser = async () => {
  try {
    await AsyncStorage.removeItem(USER_KEY);
    await AsyncStorage.removeItem(DECKS_KEY);
    await AsyncStorage.removeItem(CLASSROOM_KEY);
    await AsyncStorage.removeItem(MOOD_KEY);
  } catch (err) {
    console.error('Error logging out:', err);
  }
};

/**
 * Retrieves all decks saved locally.
 */
export const getDecks = async () => {
  try {
    const decks = await AsyncStorage.getItem(DECKS_KEY);
    return decks ? JSON.parse(decks) : [];
  } catch (err) {
    console.error('Error fetching decks:', err);
    return [];
  }
};

/**
 * Appends a new deck to local AsyncStorage.
 */
export const saveDeck = async (deck) => {
  try {
    const decks = await getDecks();
    // Prevent duplicate entries
    const exists = decks.some(d => d.deckId === deck.deckId);
    if (!exists) {
      const updated = [deck, ...decks];
      await AsyncStorage.setItem(DECKS_KEY, JSON.stringify(updated));
      return updated;
    }
    return decks;
  } catch (err) {
    console.error('Error saving deck:', err);
    return [];
  }
};

/**
 * Stores the joined classroom identifier.
 */
export const saveClassroom = async (classroomId) => {
  try {
    await AsyncStorage.setItem(CLASSROOM_KEY, classroomId);
    return classroomId;
  } catch (err) {
    console.error('Error saving classroom:', err);
    return null;
  }
};

/**
 * Retrieves the classroom identifier.
 */
export const getClassroom = async () => {
  try {
    return await AsyncStorage.getItem(CLASSROOM_KEY);
  } catch (err) {
    console.error('Error fetching classroom:', err);
    return null;
  }
};

/**
 * Logs a pre-session energy check-in (mood log).
 */
export const saveMood = async (mood) => {
  try {
    const today = new Date().toDateString();
    const moodLog = { mood, date: today };
    await AsyncStorage.setItem(MOOD_KEY, JSON.stringify(moodLog));
    return moodLog;
  } catch (err) {
    console.error('Error saving mood:', err);
    return null;
  }
};

/**
 * Retrieves today's mood, if logged.
 */
export const getMood = async () => {
  try {
    const moodData = await AsyncStorage.getItem(MOOD_KEY);
    if (moodData) {
      const parsed = JSON.parse(moodData);
      if (parsed.date === new Date().toDateString()) {
        return parsed.mood;
      }
    }
    return null;
  } catch (err) {
    console.error('Error fetching mood:', err);
    return null;
  }
};

/**
 * Clears all storage (useful for demo resetting).
 */
export const clearAllStorage = async () => {
  try {
    await AsyncStorage.clear();
    console.log("Storage reset complete.");
  } catch (err) {
    console.error("Error clearing storage:", err);
  }
};
