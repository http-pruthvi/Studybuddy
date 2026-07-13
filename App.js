import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import 'react-native-gesture-handler';

// Import Screens
import OnboardingScreen from './screens/OnboardingScreen';
import HomeScreen from './screens/HomeScreen';
import CaptureScreen from './screens/CaptureScreen';
import FlashcardsScreen from './screens/FlashcardsScreen';
import QuizScreen from './screens/QuizScreen';
import LeaderboardScreen from './screens/LeaderboardScreen';

// Import Local Storage Utils
import { getUser } from './utils/storage';

const Stack = createStackNavigator();

export default function App() {
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(true);
  
  useEffect(() => {
    // Check if user session already exists on startup
    const setupUser = async () => {
      try {
        const currentUser = await getUser();
        setUser(currentUser);
      } catch (err) {
        console.error("Failed to initialize user session: ", err);
      } finally {
        setInitializing(false);
      }
    };
    setupUser();
  }, []);

  if (initializing) {
    return <View style={{ flex: 1, backgroundColor: '#07080f' }} />;
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <NavigationContainer theme={CustomDarkTheme}>
        <Stack.Navigator
          screenOptions={{
            headerStyle: {
              backgroundColor: '#0c0f1d',
              elevation: 0,
              shadowOpacity: 0,
              borderBottomWidth: 1,
              borderBottomColor: '#202945',
            },
            headerTintColor: '#ffffff',
            headerTitleStyle: {
              fontWeight: '700',
              fontSize: 18,
              letterSpacing: 0.5,
            },
            headerBackTitleVisible: false,
            cardStyle: { backgroundColor: '#07080f' },
          }}
        >
          {user === null ? (
            <Stack.Screen 
              name="Onboarding" 
              component={OnboardingScreen} 
              options={{ headerShown: false }}
              initialParams={{ onComplete: (u) => setUser(u) }}
            />
          ) : (
            <>
              <Stack.Screen 
                name="Home" 
                component={HomeScreen} 
                options={{ title: 'StudyBuddy Graph' }}
                initialParams={{ onLogout: () => setUser(null) }}
              />
              <Stack.Screen 
                name="Capture" 
                component={CaptureScreen} 
                options={{ title: 'Explain to Learn' }}
              />
              <Stack.Screen 
                name="Flashcards" 
                component={FlashcardsScreen} 
                options={{ title: 'Flashcards' }}
              />
              <Stack.Screen 
                name="Quiz" 
                component={QuizScreen} 
                options={{ title: 'Active Recall Quiz' }}
              />
              <Stack.Screen 
                name="Leaderboard" 
                component={LeaderboardScreen} 
                options={{ title: 'Classroom Leaderboard' }}
              />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </View>
  );
}

const CustomDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: '#07080f',
    card: '#0c0f1d',
    text: '#ffffff',
    border: '#202945',
    primary: '#7c4dff',
  },
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#07080f',
  },
});
