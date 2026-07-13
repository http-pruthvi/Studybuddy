import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TextInput, 
  TouchableOpacity, 
  ActivityIndicator, 
  ScrollView, 
  Alert,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { Mic, Square, Check, ArrowRight, Languages } from 'lucide-react-native';

import { getUser, getClassroom } from '../utils/storage';
import { generateDeck, autoLearnTopic } from '../utils/workflowClient';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';

export default function CaptureScreen({ navigation }) {
  const [text, setText] = useState('');
  const [language, setLanguage] = useState('en-IN');
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  
  // Auto Gather / Gemini States
  const [captureMode, setCaptureMode] = useState('explain'); // 'explain' or 'auto_gather'
  const [autoGatherQuery, setAutoGatherQuery] = useState('');
  
  // Real Voice Recording States
  const [isRecording, setIsRecording] = useState(false);
  const [recording, setRecording] = useState(null);
  const [audioBase64, setAudioBase64] = useState(null);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [waveHeights, setWaveHeights] = useState([10, 10, 10, 10, 10, 10, 10, 10]);

  // Handle Recording Timer and Wave animation
  useEffect(() => {
    let timer;
    let waveInterval;
    
    if (isRecording) {
      timer = setInterval(() => {
        setRecordSeconds(prev => {
          if (prev >= 29) {
            handleStopRecording();
            return 30;
          }
          return prev + 1;
        });
      }, 1000);

      waveInterval = setInterval(() => {
        setWaveHeights(Array.from({ length: 8 }, () => Math.floor(Math.random() * 45) + 5));
      }, 150);
    } else {
      setRecordSeconds(0);
      setWaveHeights([10, 10, 10, 10, 10, 10, 10, 10]);
    }

    return () => {
      clearInterval(timer);
      clearInterval(waveInterval);
    };
  }, [isRecording]);

  const handleStartRecording = async () => {
    try {
      console.log('Requesting microphone permissions..');
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert("Permission Denied", "Microphone access is required to record audio.");
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      console.log('Starting recording..');
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(recording);
      setIsRecording(true);
      setAudioBase64(null);
      console.log('Recording started');
    } catch (err) {
      console.error('Failed to start recording', err);
      Alert.alert("Recording Error", "Failed to start microphone recording.");
    }
  };

  const handleStopRecording = async () => {
    if (!recording) return;
    
    setIsRecording(false);
    
    try {
      console.log('Stopping recording..');
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      console.log('Recording stopped and stored at', uri);
      
      // Read the audio file as base64 string
      const base64Data = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      
      setAudioBase64(base64Data);
      setText("Audio recorded successfully. Click generate to transcribe and build your graph.");
      setRecording(null);
      Alert.alert("Audio Recorded!", "Audio explanation captured. Click the generate button below to parse.");
    } catch (err) {
      console.error('Failed to stop recording', err);
      Alert.alert("Recording Error", "Failed to stop recording or retrieve file.");
    }
  };

  const handleGenerate = async () => {
    if (!text.trim()) {
      Alert.alert("Input Required", "Please type or speak an explanation before generating a deck.");
      return;
    }

    setLoading(true);
    setLoadingMessage('Initializing Render Workflow...');
    
    try {
      const user = await getUser();
      const classroomId = await getClassroom();
      
      setTimeout(() => setLoadingMessage('Sarvam AI extracting key concepts...'), 1000);
      setTimeout(() => setLoadingMessage('Building Topic Node relationships...'), 2500);
      setTimeout(() => setLoadingMessage('Upserting Neo4j AuraDB graph models...'), 4000);

      const response = await generateDeck(
        user.id,
        user.name,
        text,
        audioBase64, // Real Base64 audio string recorded by the user
        language,
        classroomId
      );

      setLoading(false);
      
      if (response.data) {
        Alert.alert(
          "Knowledge Generated!",
          response.isFallback 
            ? "Server is currently offline. Loaded using local heuristic fallback."
            : "Successfully merged concepts into your personal Knowledge Graph!",
          [
            { 
              text: "View Flashcards", 
              onPress: () => navigation.replace('Flashcards', { deck: response.data })
            }
          ]
        );
      } else {
        Alert.alert("Error", "Workflow failed to produce a valid study deck.");
      }
    } catch (err) {
      setLoading(false);
      Alert.alert("Execution Failed", err.message);
    }
  };

  const handleAutoLearn = async () => {
    if (!autoGatherQuery.trim()) {
      Alert.alert("Required", "Please enter a topic name to research.");
      return;
    }
    
    setLoading(true);
    setLoadingMessage(`Gemini AI researching "${autoGatherQuery.trim()}"...`);
    
    try {
      const user = await getUser();
      const classroomId = await getClassroom();
      
      const response = await autoLearnTopic(
        autoGatherQuery.trim(),
        user.id,
        user.name,
        classroomId
      );

      setLoading(false);
      
      if (response.data) {
        Alert.alert(
          "Topic Loaded!",
          "Gemini has successfully gathered the concept map details and created the study deck!",
          [
            { 
              text: "View Flashcards", 
              onPress: () => navigation.replace('Flashcards', { deck: response.data })
            }
          ]
        );
      } else {
        Alert.alert("Error", "Gemini failed to generate a valid study deck.");
      }
    } catch (err) {
      setLoading(false);
      Alert.alert("Auto-Learn Failed", err.message);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* MODE SELECTOR */}
        <View style={styles.modeContainer}>
          <TouchableOpacity 
            style={[styles.modeTab, captureMode === 'explain' && styles.modeTabActive]} 
            onPress={() => setCaptureMode('explain')}
          >
            <Text style={[styles.modeTabText, captureMode === 'explain' && styles.modeTabTextActive]}>Self Explanation</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.modeTab, captureMode === 'auto_gather' && styles.modeTabActive]} 
            onPress={() => setCaptureMode('auto_gather')}
          >
            <Text style={[styles.modeTabText, captureMode === 'auto_gather' && styles.modeTabTextActive]}>Auto-Gather (Gemini)</Text>
          </TouchableOpacity>
        </View>

        {captureMode === 'explain' ? (
          <>
            {/* LANGUAGE SELECTOR */}
            <View style={styles.section}>
              <Text style={styles.label}>Select Study Language</Text>
              <View style={styles.languageContainer}>
                {[
                  { code: 'en-IN', name: 'English' },
                  { code: 'hi-IN', name: 'हिन्दी (Hindi)' },
                  { code: 'ta-IN', name: 'தமிழ் (Tamil)' }
                ].map((lang) => (
                  <TouchableOpacity
                    key={lang.code}
                    style={[
                      styles.languageChip,
                      language === lang.code && styles.languageChipActive
                    ]}
                    onPress={() => setLanguage(lang.code)}
                  >
                    <Languages color={language === lang.code ? '#ffffff' : '#90a4ae'} size={14} style={{ marginRight: 6 }} />
                    <Text style={[
                      styles.languageChipText,
                      language === lang.code && styles.languageChipTextActive
                    ]}>{lang.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* VOICE INPUT OR TEXT INPUT */}
            <View style={styles.section}>
              <Text style={styles.label}>Speak Your Explanation</Text>
              
              <View style={styles.voiceCard}>
                {isRecording ? (
                  <View style={styles.recordingInterface}>
                    <Text style={styles.timerText}>00:{recordSeconds < 10 ? `0${recordSeconds}` : recordSeconds}</Text>
                    
                    {/* Glowing Waveform Bars */}
                    <View style={styles.waveform}>
                      {waveHeights.map((h, i) => (
                        <View 
                          key={i} 
                          style={[styles.waveBar, { height: h, backgroundColor: '#7c4dff' }]} 
                        />
                      ))}
                    </View>

                    <TouchableOpacity style={styles.recordButtonStop} onPress={handleStopRecording}>
                      <Square color="#ffffff" size={24} fill="#ffffff" />
                    </TouchableOpacity>
                    <Text style={styles.voiceSub}>Tap square to stop and transcribe</Text>
                  </View>
                ) : (
                  <View style={styles.idleInterface}>
                    <TouchableOpacity style={styles.recordButtonStart} onPress={handleStartRecording}>
                      <Mic color="#ffffff" size={32} />
                    </TouchableOpacity>
                    <Text style={styles.voiceTitle}>Press to Speak</Text>
                    <Text style={styles.voiceSub}>Explain the concept in your chosen language (max 30s)</Text>
                  </View>
                )}
              </View>
            </View>

            {/* TYPED INPUT FORM */}
            <View style={styles.section}>
              <Text style={styles.label}>Or Type Explanation Details</Text>
              <TextInput
                style={styles.textInput}
                multiline
                numberOfLines={6}
                placeholder={
                  language === 'hi-IN' 
                    ? 'जैसे: पौधों में प्रकाश संश्लेषण सूर्य के प्रकाश, क्लोरोफिल और पानी की मदद से होता है...' 
                    : 'e.g. Chlorophyll absorbs solar energy to kickstart the photosynthesis cycle...'
                }
                placeholderTextColor="#546e7a"
                value={text}
                onChangeText={setText}
              />
            </View>
          </>
        ) : (
          /* AUTO GATHER INPUT */
          <View style={styles.section}>
            <Text style={styles.label}>What do you want to learn about?</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. Black Holes, Quantum Mechanics, Machine Learning..."
              placeholderTextColor="#546e7a"
              value={autoGatherQuery}
              onChangeText={setAutoGatherQuery}
              autoFocus
            />
            <Text style={[styles.voiceSub, { marginTop: 12, textAlign: 'left' }]}>
              Enter any topic in the world. Google Gemini will research it, create the concept nodes/edges in your graph database, and build a review flashcard deck.
            </Text>
          </View>
        )}

        {/* SUBMIT ACTION BUTTON */}
        <TouchableOpacity 
          style={styles.submitButton} 
          onPress={captureMode === 'explain' ? handleGenerate : handleAutoLearn}
        >
          <Text style={styles.submitText}>
            {captureMode === 'explain' ? "Grow Knowledge Graph" : "Research & Auto-Learn"}
          </Text>
          <ArrowRight color="#ffffff" size={20} />
        </TouchableOpacity>

      </ScrollView>

      {/* LOADER OVERLAY */}
      {loading && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color="#00e5ff" />
            <Text style={styles.loadingHeader}>Durable Workflow Running</Text>
            <Text style={styles.loadingSub}>{loadingMessage}</Text>
          </View>
        </View>
      )}

    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#07080f',
  },
  scrollContent: {
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  label: {
    color: '#90a4ae',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
  },
  languageContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  languageChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0c0f1d',
    borderWidth: 1,
    borderColor: '#202945',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 14,
    marginRight: 8,
    marginBottom: 8,
  },
  languageChipActive: {
    borderColor: '#7c4dff',
    backgroundColor: '#261c47',
  },
  languageChipText: {
    color: '#b0bec5',
    fontSize: 13,
    fontWeight: '500',
  },
  languageChipTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  voiceCard: {
    backgroundColor: '#0c0f1d',
    borderWidth: 1,
    borderColor: '#202945',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
  },
  idleInterface: {
    alignItems: 'center',
  },
  recordButtonStart: {
    backgroundColor: '#7c4dff',
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
    shadowColor: '#7c4dff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  voiceTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  voiceSub: {
    color: '#90a4ae',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 12,
  },
  recordingInterface: {
    alignItems: 'center',
    width: '100%',
  },
  timerText: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginBottom: 12,
  },
  waveform: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 60,
    marginBottom: 20,
    width: '100%',
  },
  waveBar: {
    width: 4,
    borderRadius: 2,
    marginHorizontal: 3,
  },
  recordButtonStop: {
    backgroundColor: '#f44336',
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#f44336',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  textInput: {
    backgroundColor: '#0c0f1d',
    borderWidth: 1,
    borderColor: '#202945',
    borderRadius: 16,
    padding: 16,
    color: '#ffffff',
    fontSize: 15,
    textAlignVertical: 'top',
  },
  submitButton: {
    backgroundColor: '#7c4dff',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    marginTop: 10,
    marginBottom: 40,
    shadowColor: '#7c4dff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  submitText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    marginRight: 8,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(5, 6, 12, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingCard: {
    backgroundColor: '#0c0f1d',
    borderWidth: 1,
    borderColor: '#202945',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    width: '100%',
  },
  loadingHeader: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 20,
  },
  loadingSub: {
    color: '#00e5ff',
    fontSize: 13,
    marginTop: 8,
    textAlign: 'center',
    fontWeight: '600',
  },
  modeContainer: {
    flexDirection: 'row',
    backgroundColor: '#0c0f1d',
    borderRadius: 14,
    padding: 4,
    borderWidth: 1,
    borderColor: '#202945',
    marginBottom: 24,
  },
  modeTab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 10,
  },
  modeTabActive: {
    backgroundColor: '#7c4dff',
  },
  modeTabText: {
    color: '#90a4ae',
    fontSize: 14,
    fontWeight: '700',
  },
  modeTabTextActive: {
    color: '#ffffff',
  },
});
