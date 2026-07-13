import React, { useState, useRef } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  ScrollView, 
  Dimensions, 
  SafeAreaView, 
  KeyboardAvoidingView, 
  Platform,
  Alert
} from 'react-native';
import { Mic, GitBranch, Flame, Sparkles, Award, ArrowRight, User } from 'lucide-react-native';
import { saveUser } from '../utils/storage';
import { registerUser, loginUser } from '../utils/workflowClient';

const { width, height } = Dimensions.get('window');

const slides = [
  {
    key: 'explain',
    title: 'Explain to Learn',
    description: 'Speak or type explanations in English, Hindi, or other languages. Leverage the Feynman technique to solidify your understanding.',
    icon: Mic,
    color: '#7c4dff',
  },
  {
    key: 'graph',
    title: 'Grow Your Mind Map',
    description: 'Watch your thoughts form an interactive concept graph. Cross-language linking merges multi-lingual terms into singular nodes.',
    icon: GitBranch,
    color: '#00e676',
  },
  {
    key: 'active',
    title: 'Active Recall Practice',
    description: 'Review with dynamically generated cards, score your performance, and unlock milestones as you keep your mastery streak alive.',
    icon: Flame,
    color: '#ff9100',
  }
];

export default function OnboardingScreen({ route, navigation }) {
  const [activeSlide, setActiveSlide] = useState(0);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(false);
  const [themeColor, setThemeColor] = useState('#7c4dff'); // Purple default
  const [loading, setLoading] = useState(false);
  
  const scrollViewRef = useRef(null);

  const handleScroll = (event) => {
    const slideIndex = Math.round(event.nativeEvent.contentOffset.x / width);
    setActiveSlide(slideIndex);
  };

  const nextSlide = () => {
    if (activeSlide < 3) {
      const nextIndex = activeSlide + 1;
      scrollViewRef.current?.scrollTo({ x: nextIndex * width, animated: true });
      setActiveSlide(nextIndex);
    }
  };

  const handleRegister = async () => {
    if (!name.trim()) {
      Alert.alert("Required", "Please enter a display name to get started.");
      return;
    }
    if (!username.trim()) {
      Alert.alert("Required", "Please enter a unique username.");
      return;
    }
    if (!password.trim()) {
      Alert.alert("Required", "Please set an account password.");
      return;
    }
    try {
      setLoading(true);
      const backendUser = await registerUser(
        username.trim(),
        password.trim(),
        name.trim()
      );
      
      const newUser = {
        id: backendUser.id,
        name: backendUser.name,
        username: backendUser.username,
        streak: backendUser.streak || 0,
        theme: themeColor
      };
      await saveUser(newUser);
      
      if (route.params?.onComplete) {
        route.params.onComplete(newUser);
      } else {
        navigation.replace('Home');
      }
    } catch (err) {
      Alert.alert("Registration Error", err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!username.trim()) {
      Alert.alert("Required", "Please enter your username.");
      return;
    }
    if (!password.trim()) {
      Alert.alert("Required", "Please enter your account password.");
      return;
    }
    try {
      setLoading(true);
      const backendUser = await loginUser(
        username.trim(),
        password.trim()
      );
      
      const user = {
        id: backendUser.id,
        name: backendUser.name,
        username: backendUser.username,
        streak: backendUser.streak || 0,
        theme: themeColor
      };
      await saveUser(user);
      
      if (route.params?.onComplete) {
        route.params.onComplete(user);
      } else {
        navigation.replace('Home');
      }
    } catch (err) {
      Alert.alert("Login Error", err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardContainer}
      >
        <ScrollView 
          ref={scrollViewRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleScroll}
          scrollEnabled={activeSlide < 3} // Lock scroll on Auth view to focus inputs
        >
          {/* Introductory Slides */}
          {slides.map((slide, index) => {
            const IconComponent = slide.icon;
            return (
              <View key={slide.key} style={styles.slide}>
                <View style={styles.iconContainer}>
                  <View style={[styles.glowCircle, { shadowColor: slide.color }]} />
                  <IconComponent size={84} color={slide.color} />
                </View>
                
                <Text style={styles.slideTitle}>{slide.title}</Text>
                <Text style={styles.slideDescription}>{slide.description}</Text>
              </View>
            );
          })}

          {/* Slide 4: Authentication & Setup Screen */}
          <View style={styles.slide}>
            <View style={styles.authContainer}>
              <View style={styles.logoContainer}>
                <Sparkles size={48} color={themeColor} />
                <Text style={styles.authTitle}>Your Study Profile</Text>
                <Text style={styles.authSub}>Set up your personal namespace to start learning</Text>
              </View>

              {isLogin ? (
                // Login Flow
                <View style={styles.form}>
                  <Text style={styles.label}>USERNAME</Text>
                  <TextInput 
                    style={[styles.input, { borderColor: themeColor }]}
                    placeholder="e.g. pruthvi"
                    placeholderTextColor="#546e7a"
                    value={username}
                    onChangeText={setUsername}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  
                  <Text style={styles.label}>PASSWORD</Text>
                  <TextInput 
                    style={[styles.input, { borderColor: themeColor }]}
                    placeholder="Enter password"
                    placeholderTextColor="#546e7a"
                    secureTextEntry
                    value={password}
                    onChangeText={setPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />

                  <TouchableOpacity 
                    style={[styles.primaryButton, { backgroundColor: themeColor }]}
                    onPress={handleLogin}
                  >
                    <Text style={styles.buttonText}>Load Workspace</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                // Register Flow
                <View style={styles.form}>
                  <Text style={styles.label}>DISPLAY NAME</Text>
                  <TextInput 
                    style={[styles.input, { borderColor: themeColor }]}
                    placeholder="e.g. Pruthvi"
                    placeholderTextColor="#546e7a"
                    value={name}
                    onChangeText={setName}
                  />

                  <Text style={styles.label}>USERNAME</Text>
                  <TextInput 
                    style={[styles.input, { borderColor: themeColor }]}
                    placeholder="e.g. pruthvi123"
                    placeholderTextColor="#546e7a"
                    value={username}
                    onChangeText={setUsername}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />

                  <Text style={styles.label}>PASSWORD</Text>
                  <TextInput 
                    style={[styles.input, { borderColor: themeColor }]}
                    placeholder="Choose password"
                    placeholderTextColor="#546e7a"
                    secureTextEntry
                    value={password}
                    onChangeText={setPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />

                  <Text style={styles.label}>CHOOSE AN ACCENT THEME</Text>
                  <View style={styles.colorPalette}>
                    {['#7c4dff', '#00e676', '#ff9100', '#00e5ff'].map((color) => (
                      <TouchableOpacity
                        key={color}
                        style={[
                          styles.colorCircle,
                          { backgroundColor: color },
                          themeColor === color && styles.colorCircleSelected
                        ]}
                        onPress={() => setThemeColor(color)}
                      />
                    ))}
                  </View>

                  <TouchableOpacity 
                    style={[styles.primaryButton, { backgroundColor: themeColor }]}
                    onPress={handleRegister}
                  >
                    <Text style={styles.buttonText}>Enter StudyBuddy</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Toggle Switch */}
              <TouchableOpacity 
                style={styles.toggleText}
                onPress={() => setIsLogin(!isLogin)}
              >
                <Text style={styles.toggleSub}>
                  {isLogin ? "New user? Create a profile" : "Have an existing account? Login"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>

        {/* Footer Navigation Controls */}
        {activeSlide < 3 && (
          <View style={styles.footer}>
            {/* Pagination Indicators */}
            <View style={styles.indicatorContainer}>
              {[0, 1, 2, 3].map((_, index) => (
                <View 
                  key={index} 
                  style={[
                    styles.dot, 
                    activeSlide === index ? styles.dotActive : null,
                    activeSlide === index ? { backgroundColor: themeColor } : null
                  ]} 
                />
              ))}
            </View>

            {/* Action Button */}
            <TouchableOpacity 
              style={[styles.actionButton, { backgroundColor: themeColor }]} 
              onPress={nextSlide}
            >
              <ArrowRight size={24} color="#ffffff" />
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#07080f',
  },
  keyboardContainer: {
    flex: 1,
  },
  slide: {
    width: width,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  iconContainer: {
    width: 180,
    height: 180,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
  },
  glowCircle: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(124, 77, 255, 0.05)',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 36,
  },
  slideTitle: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 16,
    letterSpacing: 0.5,
  },
  slideDescription: {
    color: '#90a4ae',
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  footer: {
    position: 'absolute',
    bottom: 48,
    left: 32,
    right: 32,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  indicatorContainer: {
    flexDirection: 'row',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#202945',
    marginRight: 8,
  },
  dotActive: {
    width: 24,
  },
  actionButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  authContainer: {
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  authTitle: {
    color: '#ffffff',
    fontSize: 26,
    fontWeight: '800',
    marginTop: 16,
  },
  authSub: {
    color: '#90a4ae',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 20,
  },
  form: {
    width: '100%',
    backgroundColor: '#0c0f1d',
    borderWidth: 1,
    borderColor: '#202945',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 6,
  },
  label: {
    color: '#90a4ae',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  input: {
    backgroundColor: '#07080f',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#ffffff',
    fontSize: 16,
    marginBottom: 20,
  },
  colorPalette: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  colorCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 3,
    borderColor: 'transparent',
  },
  colorCircleSelected: {
    borderColor: '#ffffff',
    transform: [{ scale: 1.1 }],
  },
  primaryButton: {
    borderRadius: 14,
    paddingVertical: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  toggleText: {
    marginTop: 24,
    padding: 10,
  },
  toggleSub: {
    color: '#90a4ae',
    fontSize: 14,
    fontWeight: '600',
  }
});
