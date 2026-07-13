import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TouchableOpacity, 
  ScrollView, 
  ActivityIndicator, 
  Dimensions, 
  TextInput,
  Modal,
  Alert 
} from 'react-native';
import Svg, { Line, Circle, Text as SvgText, G } from 'react-native-svg';
import { 
  Plus, 
  Zap, 
  Users, 
  Settings, 
  RotateCcw, 
  CheckCircle2, 
  Flame, 
  Sparkles 
} from 'lucide-react-native';
import { useIsFocused } from '@react-navigation/native';

import { getUser, getDecks, getMood, saveMood, saveClassroom, getClassroom, logoutUser } from '../utils/storage';
import { getUserGraph, getApiUrl, setApiUrl, joinClassroom } from '../utils/workflowClient';

const { width } = Dimensions.get('window');
const CANVAS_SIZE = width - 32;

export default function HomeScreen({ route, navigation }) {
  const isFocused = useIsFocused();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [decks, setDecks] = useState([]);
  const [mood, setMood] = useState(null);
  const [classroom, setClassroom] = useState(null);
  const [apiEndpoint, setApiEndpoint] = useState('');
  
  // Graph States
  const [graphData, setGraphData] = useState({ nodes: [], edges: [] });
  const [nodePositions, setNodePositions] = useState({});
  const [selectedNode, setSelectedNode] = useState(null);
  const [classHeatmap, setClassHeatmap] = useState([]);
  
  // Modals
  const [showSettings, setShowSettings] = useState(false);
  const [showJoinClass, setShowJoinClass] = useState(false);
  const [classCodeInput, setClassCodeInput] = useState('');

  // 1. Initial Load and Focus Updates
  useEffect(() => {
    if (isFocused) {
      loadData();
    }
  }, [isFocused]);

  const loadData = async () => {
    setLoading(true);
    try {
      const activeUser = await getUser();
      setUser(activeUser);
      
      const activeDecks = await getDecks();
      setDecks(activeDecks);
      
      const activeMood = await getMood();
      setMood(activeMood);
      
      const classId = await getClassroom();
      setClassroom(classId);
      
      const currentUrl = await getApiUrl();
      setApiEndpoint(currentUrl);

      if (activeUser) {
        const graph = await getUserGraph(activeUser.id);
        setGraphData(graph);
        runForceSimulation(graph.nodes, graph.edges);
      }

      if (classId) {
        try {
          const response = await fetch(`${currentUrl}/classrooms/${classId}/heatmap`);
          if (response.ok) {
            const data = await response.json();
            setClassHeatmap(data.topics || []);
          }
        } catch (e) {
          console.warn("Failed to fetch class heatmap overlay:", e);
        }
      }
    } catch (err) {
      console.error("Error loading home details:", err);
    } finally {
      setLoading(false);
    }
  };

  // 2. Simple Force-Directed Layout Simulation
  const runForceSimulation = (nodes, edges) => {
    if (!nodes || nodes.length === 0) return;

    const center = CANVAS_SIZE / 2;
    const positions = {};
    const velocities = {};

    // Initialize positions randomly in the center
    nodes.forEach(node => {
      positions[node.id] = {
        x: center + (Math.random() - 0.5) * 100,
        y: center + (Math.random() - 0.5) * 100
      };
      velocities[node.id] = { x: 0, y: 0 };
    });

    const k = 60; // Optimal distance
    const damping = 0.85;

    // Run layout algorithm for 60 iterations
    for (let iter = 0; iter < 120; iter++) {
      // A. Calculate repulsion between all node pairs
      for (let i = 0; i < nodes.length; i++) {
        const n1 = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const n2 = nodes[j];
          const dx = positions[n1.id].x - positions[n2.id].x;
          const dy = positions[n1.id].y - positions[n2.id].y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1.0;
          
          if (dist < 200) {
            const force = (k * k) / dist;
            const fx = (dx / dist) * force * 0.5;
            const fy = (dy / dist) * force * 0.5;
            
            velocities[n1.id].x += fx;
            velocities[n1.id].y += fy;
            velocities[n2.id].x -= fx;
            velocities[n2.id].y -= fy;
          }
        }
      }

      // B. Calculate attraction along edges
      edges.forEach(edge => {
        const sourcePos = positions[edge.source];
        const targetPos = positions[edge.target];
        if (!sourcePos || !targetPos) return;

        const dx = targetPos.x - sourcePos.x;
        const dy = targetPos.y - sourcePos.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1.0;
        
        const force = (dist * dist) / k;
        const fx = (dx / dist) * force * 0.1;
        const fy = (dy / dist) * force * 0.1;

        velocities[edge.source].x += fx;
        velocities[edge.source].y += fy;
        velocities[edge.target].x -= fx;
        velocities[edge.target].y -= fy;
      });

      // C. Update positions with damping and center gravity
      nodes.forEach(node => {
        const pos = positions[node.id];
        const vel = velocities[node.id];
        
        // Gravity to center
        const dx = center - pos.x;
        const dy = center - pos.y;
        vel.x += dx * 0.05;
        vel.y += dy * 0.05;

        pos.x += vel.x * 0.1;
        pos.y += vel.y * 0.1;

        vel.x *= damping;
        vel.y *= damping;

        // Keep inside bounds
        pos.x = Math.max(25, Math.min(CANVAS_SIZE - 25, pos.x));
        pos.y = Math.max(25, Math.min(CANVAS_SIZE - 25, pos.y));
      });
    }

    setNodePositions(positions);
  };

  // 3. User Actions
  const handleMoodSelect = async (selectedMood) => {
    setMood(selectedMood);
    await saveMood(selectedMood);
  };

  const handleSaveSettings = async () => {
    await setApiUrl(apiEndpoint);
    setShowSettings(false);
    loadData();
  };

  const handleLogout = async () => {
    Alert.alert(
      "Log Out",
      "Are you sure you want to log out? This will clear your local user profile session.",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Log Out", 
          style: "destructive", 
          onPress: async () => {
            await logoutUser();
            setShowSettings(false);
            if (route.params?.onLogout) {
              route.params.onLogout();
            }
          } 
        }
      ]
    );
  };

  const handleJoinClass = async () => {
    if (!classCodeInput.trim()) return;
    try {
      setLoading(true);
      await joinClassroom(user.id, classCodeInput.trim());
      await saveClassroom(classCodeInput.trim());
      setClassroom(classCodeInput.trim());
      setShowJoinClass(false);
      Alert.alert("Classroom Joined!", `You are now a member of classroom: ${classCodeInput}`);
      loadData();
    } catch {
      Alert.alert("Error", "Could not connect to classroom backend.");
    } finally {
      setLoading(false);
    }
  };

  // 4. Color mappings for node masteries
  const getNodeColor = (score) => {
    if (score >= 0.7) return '#4caf50'; // Mastered - Green
    if (score >= 0.4) return '#ffb74d'; // Studying - Orange
    return '#f44336'; // New/Weak - Red
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* HEADER USER BAR */}
        <View style={styles.headerBar}>
          <View>
            <Text style={styles.welcomeText}>Welcome back,</Text>
            <Text style={styles.userName}>{user?.name || 'Loading...'}</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.iconButton} onPress={() => setShowSettings(true)}>
              <Settings color="#ffffff" size={20} />
            </TouchableOpacity>
          </View>
        </View>

        {/* STATS STRIP */}
        <View style={styles.statsStrip}>
          <View style={styles.statCard}>
            <Flame color="#ff5722" size={24} style={styles.statIcon} />
            <Text style={styles.statValue}>{user?.streak || 0} Days</Text>
            <Text style={styles.statLabel}>Streak</Text>
          </View>
          
          <View style={styles.statCard}>
            <CheckCircle2 color="#7c4dff" size={24} style={styles.statIcon} />
            <Text style={styles.statValue}>{decks.length} Decks</Text>
            <Text style={styles.statLabel}>Generated</Text>
          </View>

          <TouchableOpacity 
            style={[styles.statCard, classroom && styles.classroomCardActive]} 
            onPress={() => classroom ? navigation.navigate('Leaderboard', { classroomId: classroom }) : setShowJoinClass(true)}
          >
            <Users color={classroom ? "#00e5ff" : "#b0bec5"} size={24} style={styles.statIcon} />
            <Text style={[styles.statValue, classroom && styles.activeClassText]}>
              {classroom ? classroom : 'Join'}
            </Text>
            <Text style={styles.statLabel}>{classroom ? 'Classroom' : 'Leaderboard'}</Text>
          </TouchableOpacity>
        </View>

        {/* DAILY MOOD CHECK */}
        <View style={styles.moodSection}>
          <Text style={styles.sectionTitle}>Daily Mood Check-in</Text>
          <View style={styles.moodContainer}>
            {['Fresh', 'OK', 'Tired'].map((m) => (
              <TouchableOpacity
                key={m}
                style={[
                  styles.moodChip,
                  mood === m && styles.moodChipActive
                ]}
                onPress={() => handleMoodSelect(m)}
              >
                <Text style={[
                  styles.moodChipText,
                  mood === m && styles.moodChipTextActive
                ]}>{m === 'Fresh' ? '⚡ Fresh' : m === 'OK' ? '😐 OK' : '😴 Tired'}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* KNOWLEDGE GRAPH HERO BOX */}
        <View style={styles.graphContainer}>
          <View style={styles.graphHeader}>
            <Text style={styles.sectionTitle}>Your Knowledge Graph</Text>
            <TouchableOpacity onPress={loadData}>
              <RotateCcw color="#7c4dff" size={16} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.graphPlaceholder}>
              <ActivityIndicator size="large" color="#7c4dff" />
            </View>
          ) : graphData.nodes.length === 0 ? (
            <View style={styles.graphPlaceholder}>
              <Sparkles color="#7c4dff" size={40} style={{ marginBottom: 12 }} />
              <Text style={styles.placeholderText}>Your Graph is empty.</Text>
              <Text style={styles.placeholderSubText}>Explain a concept to start growing your knowledge network.</Text>
            </View>
          ) : (
            <View style={styles.graphCanvas}>
              <Svg width={CANVAS_SIZE} height={CANVAS_SIZE}>
                {/* 1. Draw Links/Edges */}
                {graphData.edges.map((edge, index) => {
                  const sourcePos = nodePositions[edge.source];
                  const targetPos = nodePositions[edge.target];
                  if (!sourcePos || !targetPos) return null;
                  
                  const isPrereq = edge.type === 'PREREQUISITE_OF';
                  const weight = edge.weight || 1;
                  const baseWidth = isPrereq ? 2.0 : 1.2;
                  const strokeWidth = baseWidth + Math.min(3.0, (weight - 1) * 0.8);
                  const baseOpacity = isPrereq ? 0.6 : 0.4;
                  const opacity = Math.min(1.0, baseOpacity + (weight - 1) * 0.15);
                  
                  return (
                    <Line
                      key={`edge-${index}`}
                      x1={sourcePos.x}
                      y1={sourcePos.y}
                      x2={targetPos.x}
                      y2={targetPos.y}
                      stroke={isPrereq ? '#7c4dff' : '#00e5ff'}
                      strokeWidth={strokeWidth}
                      strokeDasharray={isPrereq ? "4,4" : "0"}
                      opacity={opacity}
                    />
                  );
                })}

                {/* 2. Draw Nodes */}
                {graphData.nodes.map((node) => {
                  const pos = nodePositions[node.id];
                  if (!pos) return null;

                  const isSelected = selectedNode?.id === node.id;
                  const color = getNodeColor(node.score);
                  
                  // Check if a classmate has studied/mastered this concept (peer-glow indicator)
                  const classTopic = classHeatmap.find(t => t.name === node.label);
                  const peerMastered = classTopic && classTopic.masteredCount > 0;
                  
                  return (
                    <G key={`node-${node.id}`} onPress={() => setSelectedNode(node)}>
                      {/* Peer Glow Ring indicator if classmates studied it */}
                      {peerMastered && (
                        <Circle
                          cx={pos.x}
                          cy={pos.y}
                          r={isSelected ? 27 : 21}
                          fill="transparent"
                          stroke="#e040fb"
                          strokeWidth={1.5}
                          strokeDasharray="3,3"
                          opacity={0.8}
                        />
                      )}

                      {/* Outer glow ring */}
                      <Circle
                        cx={pos.x}
                        cy={pos.y}
                        r={isSelected ? 22 : 16}
                        fill="transparent"
                        stroke={color}
                        strokeWidth={2}
                        opacity={isSelected ? 0.9 : 0.3}
                      />
                      
                      {/* Inner dot */}
                      <Circle
                        cx={pos.x}
                        cy={pos.y}
                        r={isSelected ? 10 : 8}
                        fill={color}
                      />

                      {/* Text Label */}
                      <SvgText
                        x={pos.x}
                        y={pos.y - (isSelected ? 26 : 20)}
                        fill="#ffffff"
                        fontSize={isSelected ? 13 : 10}
                        fontWeight={isSelected ? 'bold' : 'normal'}
                        textAnchor="middle"
                        opacity={0.9}
                      >
                        {node.label}
                      </SvgText>
                    </G>
                  );
                })}
              </Svg>

              {/* Selection Detail Overlays */}
              {selectedNode && (
                <View style={styles.selectedNodePanel}>
                  <Text style={styles.selectedNodeTitle}>{selectedNode.label.toUpperCase()}</Text>
                  
                  {/* Detailed concept teaching explanation card */}
                  <View style={styles.teachCardContainer}>
                    <Text style={styles.teachCardHeader}>Concept Explanation:</Text>
                    <Text style={styles.teachCardContent}>
                      {selectedNode.description || "A core element of this study topic."}
                    </Text>
                  </View>

                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                    <Text style={styles.selectedNodeMastery}>
                      Mastery Level: {(selectedNode.score * 100).toFixed(0)}%
                    </Text>
                    <TouchableOpacity 
                      style={styles.closeNodeButton} 
                      onPress={() => setSelectedNode(null)}
                    >
                      <Text style={styles.closeNodeText}>Dismiss</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          )}
        </View>

        {/* DECKS LIST */}
        <View style={styles.decksSection}>
          <Text style={styles.sectionTitle}>Your Generated Decks</Text>
          {decks.length === 0 ? (
            <Text style={styles.noDecksText}>No decks generated yet.</Text>
          ) : (
            decks.map((deck, idx) => (
              <TouchableOpacity
                key={deck.deckId || idx}
                style={styles.deckCard}
                onPress={() => navigation.navigate('Flashcards', { deck })}
              >
                <View style={styles.deckCardInfo}>
                  <Text style={styles.deckTitle}>{deck.title}</Text>
                  <Text style={styles.deckMeta}>
                    {(deck.concepts || []).length} Concepts • {(deck.cards || []).length} Cards
                  </Text>
                </View>
                <ChevronRightIcon color="#7c4dff" />
              </TouchableOpacity>
            ))
          )}
        </View>

      </ScrollView>

      {/* FLOATING ACTION CAPTURE BUTTON */}
      <TouchableOpacity 
        style={styles.floatingButton}
        onPress={() => navigation.navigate('Capture')}
      >
        <Plus color="#ffffff" size={30} strokeWidth={2.5} />
      </TouchableOpacity>

      {/* SETTINGS MODAL */}
      <Modal visible={showSettings} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>API Configuration</Text>
            <Text style={styles.modalLabel}>FastAPI Endpoint Target URL</Text>
            <TextInput
              style={styles.modalInput}
              value={apiEndpoint}
              onChangeText={setApiEndpoint}
              placeholder="e.g. http://localhost:8000"
              placeholderTextColor="#90a4ae"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setShowSettings(false)}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={handleSaveSettings}>
                <Text style={styles.saveButtonText}>Save</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity 
              style={[styles.logoutButton, { marginTop: 24 }]} 
              onPress={handleLogout}
            >
              <Text style={styles.logoutButtonText}>Log Out Session</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* JOIN CLASSROOM MODAL */}
      <Modal visible={showJoinClass} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Join Classroom</Text>
            <Text style={styles.modalLabel}>Enter Class Join Code</Text>
            <TextInput
              style={styles.modalInput}
              value={classCodeInput}
              onChangeText={setClassCodeInput}
              placeholder="e.g. class_sih2026"
              placeholderTextColor="#90a4ae"
              autoCapitalize="none"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setShowJoinClass(false)}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={handleJoinClass}>
                <Text style={styles.saveButtonText}>Join</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// Simple Chevron Helper
const ChevronRightIcon = ({ color }) => (
  <Svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <Line x1="9" y1="18" x2="15" y2="12" />
    <Line x1="15" y1="12" x2="9" y2="6" />
  </Svg>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#07080f',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 8,
  },
  welcomeText: {
    color: '#90a4ae',
    fontSize: 14,
  },
  userName: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '700',
  },
  headerActions: {
    flexDirection: 'row',
  },
  iconButton: {
    backgroundColor: '#1b223c',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2d375e',
  },
  statsStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  statCard: {
    backgroundColor: '#0c0f1d',
    borderWidth: 1,
    borderColor: '#202945',
    flex: 1,
    marginHorizontal: 4,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 16,
  },
  classroomCardActive: {
    borderColor: '#00e5ff',
    backgroundColor: '#061726',
  },
  activeClassText: {
    color: '#00e5ff',
  },
  statIcon: {
    marginBottom: 6,
  },
  statValue: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  statLabel: {
    color: '#90a4ae',
    fontSize: 10,
    marginTop: 2,
  },
  moodSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  moodContainer: {
    flexDirection: 'row',
  },
  moodChip: {
    backgroundColor: '#111424',
    borderWidth: 1,
    borderColor: '#202945',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginRight: 10,
  },
  moodChipActive: {
    borderColor: '#7c4dff',
    backgroundColor: '#261c47',
  },
  moodChipText: {
    color: '#b0bec5',
    fontSize: 13,
    fontWeight: '500',
  },
  moodChipTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  graphContainer: {
    backgroundColor: '#0c0f1d',
    borderWidth: 1,
    borderColor: '#202945',
    borderRadius: 24,
    padding: 16,
    marginBottom: 24,
  },
  graphHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  graphPlaceholder: {
    height: CANVAS_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  placeholderSubText: {
    color: '#90a4ae',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 6,
    paddingHorizontal: 32,
  },
  graphCanvas: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedNodePanel: {
    position: 'absolute',
    bottom: 12,
    backgroundColor: 'rgba(12, 15, 29, 0.95)',
    borderWidth: 1,
    borderColor: '#7c4dff',
    borderRadius: 16,
    padding: 16,
    width: CANVAS_SIZE - 24,
  },
  selectedNodeTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  selectedNodeMastery: {
    color: '#00e5ff',
    fontSize: 12,
    fontWeight: '700',
  },
  closeNodeButton: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    backgroundColor: '#261c47',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#7c4dff',
  },
  closeNodeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  teachCardContainer: {
    backgroundColor: '#16192e',
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#202945',
  },
  teachCardHeader: {
    color: '#7c4dff',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  teachCardContent: {
    color: '#cfd8dc',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
  decksSection: {
    marginBottom: 24,
  },
  noDecksText: {
    color: '#90a4ae',
    fontStyle: 'italic',
    textAlign: 'center',
    marginVertical: 16,
  },
  deckCard: {
    backgroundColor: '#0c0f1d',
    borderWidth: 1,
    borderColor: '#202945',
    padding: 16,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  deckCardInfo: {
    flex: 1,
  },
  deckTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  deckMeta: {
    color: '#90a4ae',
    fontSize: 12,
    marginTop: 4,
  },
  floatingButton: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    backgroundColor: '#7c4dff',
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#7c4dff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#0c0f1d',
    borderWidth: 1,
    borderColor: '#202945',
    borderRadius: 24,
    padding: 24,
  },
  modalTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  modalLabel: {
    color: '#90a4ae',
    fontSize: 12,
    marginBottom: 8,
  },
  modalInput: {
    backgroundColor: '#07080f',
    borderWidth: 1,
    borderColor: '#202945',
    borderRadius: 12,
    padding: 12,
    color: '#ffffff',
    fontSize: 14,
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  cancelButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginRight: 10,
  },
  cancelButtonText: {
    color: '#90a4ae',
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: '#7c4dff',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  saveButtonText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  logoutButton: {
    backgroundColor: '#ff1744',
    paddingVertical: 12,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoutButtonText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 14,
  },
});
