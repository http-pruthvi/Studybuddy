import React, { useState } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TouchableOpacity, 
  SafeAreaView, 
  Alert,
  ScrollView,
  TextInput,
  ActivityIndicator
} from 'react-native';
import { Flame, Sparkles, Award, ArrowRight, RotateCcw, AlertTriangle } from 'lucide-react-native';

import { getUser } from '../utils/storage';
import { updateMasteryBatch, gradeAnswer } from '../utils/workflowClient';

export default function QuizScreen({ route, navigation }) {
  const { deck } = route.params;
  const cards = deck?.cards || [];
  const concepts = deck?.concepts || [];
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [sessionScores, setSessionScores] = useState({});
  const [quizCompleted, setQuizCompleted] = useState(false);
  
  // Free text answer states
  const [studentAnswer, setStudentAnswer] = useState('');
  const [grading, setGrading] = useState(false);
  const [llmFeedback, setLlmFeedback] = useState('');
  const [llmScore, setLlmScore] = useState(null);

  // Track final summary stats
  const [correctCount, setCorrectCount] = useState(0);

  const getConceptName = (conceptId) => {
    const concept = concepts.find(c => c.id === conceptId);
    return concept ? concept.name : 'Topic';
  };

  const handleLlmGrade = async () => {
    if (!studentAnswer.trim()) {
      Alert.alert("Input Required", "Please type your answer before grading.");
      return;
    }
    setGrading(true);
    try {
      const card = cards[currentIndex];
      const result = await gradeAnswer(card.front, card.back, studentAnswer);
      setLlmScore(result.score);
      setLlmFeedback(result.feedback);
      setRevealed(true);
    } catch (e) {
      console.warn("LLM grading error:", e);
      Alert.alert("Grading Server Error", "Could not grade your response. Revealing answer for manual self-grade.", [
        { text: "OK", onPress: () => setRevealed(true) }
      ]);
    } finally {
      setGrading(false);
    }
  };

  const handleReveal = () => {
    setRevealed(true);
  };

  const handleScore = async (scoreValue) => {
    const card = cards[currentIndex];
    const concept = concepts.find(c => c.id === card.conceptId);
    const topicId = concept ? concept.canonicalTopic : card.conceptId;

    // Track score locally (averaged across topics later in finalize)
    const nextScores = { ...sessionScores };
    if (!nextScores[topicId]) {
      nextScores[topicId] = [];
    }
    nextScores[topicId].push(scoreValue);
    setSessionScores(nextScores);

    if (scoreValue >= 0.7) {
      setCorrectCount(prev => prev + 1);
    }

    // Reset answer fields
    setStudentAnswer('');
    setLlmFeedback('');
    setLlmScore(null);

    // Go to next card or complete
    if (currentIndex < cards.length - 1) {
      setRevealed(false);
      setCurrentIndex(prev => prev + 1);
    } else {
      await finalizeQuizSession(nextScores);
    }
  };

  const finalizeQuizSession = async (finalScores) => {
    try {
      const user = await getUser();
      
      // Average score per unique topic studied
      const updates = [];
      for (const [topicId, scoresArray] of Object.entries(finalScores)) {
        const avgScore = scoresArray.reduce((sum, val) => sum + val, 0) / scoresArray.length;
        updates.push({ topicId, score: avgScore });
      }

      await updateMasteryBatch(user.id, updates);
      setQuizCompleted(true);
    } catch (err) {
      console.warn("Failed to update masteries on server:", err);
      setQuizCompleted(true);
    }
  };

  if (quizCompleted) {
    const total = cards.length;
    const pct = total > 0 ? Math.round((correctCount / total) * 100) : 0;
    
    return (
      <SafeAreaView style={styles.containerCompleted}>
        <View style={styles.successCard}>
          <Award color="#00e5ff" size={60} style={{ marginBottom: 16 }} />
          <Text style={styles.successTitle}>Quiz Completed!</Text>
          <Text style={styles.successSub}>Keep studying to grow your knowledge streak.</Text>
          
          <View style={styles.scoreContainer}>
            <View style={styles.scoreCell}>
              <Text style={styles.scoreValue}>{pct}%</Text>
              <Text style={styles.scoreLabel}>Accuracy</Text>
            </View>
            <View style={styles.scoreCell}>
              <Text style={styles.scoreValue}>{correctCount}/{total}</Text>
              <Text style={styles.scoreLabel}>Score</Text>
            </View>
          </View>

          <View style={styles.streakNotice}>
            <Flame color="#ff5722" size={24} style={{ marginRight: 10 }} />
            <Text style={styles.streakNoticeText}>Knowledge Streak updated!</Text>
          </View>

          <TouchableOpacity 
            style={styles.finishButton}
            onPress={() => navigation.popToTop()}
          >
            <Text style={styles.finishButtonText}>Return to Graph</Text>
            <ArrowRight color="#ffffff" size={18} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const currentCard = cards[currentIndex];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.progressHeader}>
        <Text style={styles.progressText}>Card {currentIndex + 1} of {cards.length}</Text>
        <View style={styles.progressBarBg}>
          <View 
            style={[
              styles.progressBarFill, 
              { width: `${((currentIndex + 1) / cards.length) * 100}%` }
            ]} 
          />
        </View>
      </View>

      {/* QUIZ INTERACTIVE CARD CONTAINER */}
      <View style={styles.quizArea}>
        <View style={[styles.quizCard, revealed && styles.quizCardRevealed]}>
          <View style={styles.cardInfoStrip}>
            <Text style={styles.cardTopicLabel}>
              CONCEPT: {getConceptName(currentCard?.conceptId)}
            </Text>
          </View>

          <ScrollView contentContainerStyle={styles.cardBodyScroll}>
            <View style={styles.cardContent}>
              <Text style={styles.cardPromptText}>{currentCard?.front}</Text>
              
              {!revealed && !grading && (
                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>YOUR ANSWER:</Text>
                  <TextInput
                    style={styles.answerInput}
                    placeholder="Type your explanation here to grade it..."
                    placeholderTextColor="#546e7a"
                    multiline
                    numberOfLines={3}
                    value={studentAnswer}
                    onChangeText={setStudentAnswer}
                  />
                </View>
              )}

              {grading && (
                <View style={styles.gradingLoader}>
                  <ActivityIndicator size="small" color="#7c4dff" />
                  <Text style={styles.gradingLoaderText}>Evaluating explanation with Gemini AI...</Text>
                </View>
              )}

              {revealed && (
                <View style={styles.revealSection}>
                  <View style={styles.cardDivider} />
                  <Text style={styles.cardAnswerLabel}>CORRECT ANSWER</Text>
                  <Text style={styles.cardAnswerText}>{currentCard?.back}</Text>

                  {llmScore !== null && (
                    <View style={styles.llmFeedbackBox}>
                      <View style={styles.feedbackHeader}>
                        <Sparkles color="#00e5ff" size={16} style={{ marginRight: 6 }} />
                        <Text style={styles.feedbackTitle}>Gemini Grading (Score: {llmScore})</Text>
                      </View>
                      <Text style={styles.feedbackText}>{llmFeedback}</Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          </ScrollView>
        </View>
      </View>

      {/* ACTION PANEL */}
      <View style={styles.actionsPanel}>
        {!revealed ? (
          <View style={styles.preRevealActions}>
            <TouchableOpacity 
              style={[styles.actionButton, styles.gradeLlmButton]} 
              onPress={handleLlmGrade}
              disabled={grading}
            >
              <Sparkles color="#ffffff" size={20} style={{ marginRight: 8 }} />
              <Text style={styles.actionButtonText}>Submit & Grade Answer</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.actionButton, styles.skipButton]} 
              onPress={handleReveal}
              disabled={grading}
            >
              <Text style={styles.skipButtonText}>Skip Typing (Self-Assess)</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View>
            {llmScore !== null && (
              <TouchableOpacity 
                style={[styles.acceptLlmButton, { marginBottom: 12 }]}
                onPress={() => handleScore(llmScore)}
              >
                <CheckIcon color="#ffffff" size={18} style={{ marginRight: 6 }} />
                <Text style={styles.gradeText}>Accept AI Grade ({llmScore})</Text>
              </TouchableOpacity>
            )}

            <View style={styles.gradingContainer}>
              <TouchableOpacity 
                style={[styles.gradeButton, styles.gradeButtonAgain]}
                onPress={() => handleScore(0.3)}
              >
                <RotateCcw color="#ffffff" size={18} style={{ marginRight: 6 }} />
                <Text style={styles.gradeText}>Incorrect (0.3)</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.gradeButton, styles.gradeButtonPartial]}
                onPress={() => handleScore(0.6)}
              >
                <AlertTriangle color="#ffffff" size={18} style={{ marginRight: 6 }} />
                <Text style={styles.gradeText}>Partial (0.6)</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.gradeButton, styles.gradeButtonMastered]}
                onPress={() => handleScore(1.0)}
              >
                <Flame color="#ffffff" size={18} style={{ marginRight: 6 }} />
                <Text style={styles.gradeText}>Mastered! (1.0)</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

// Simple Check Icon placeholder to replace lucide if missing, or use a custom node
function CheckIcon({ color, size, style }) {
  return (
    <View style={[{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }, style]}>
      <Text style={{ color, fontSize: 16, fontWeight: 'bold' }}>✓</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#07080f',
  },
  progressHeader: {
    padding: 20,
    backgroundColor: '#0c0f1d',
    borderBottomWidth: 1,
    borderBottomColor: '#202945',
  },
  progressText: {
    color: '#90a4ae',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: '#1b223c',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#7c4dff',
    borderRadius: 3,
  },
  quizArea: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  quizCard: {
    backgroundColor: '#0c0f1d',
    borderWidth: 1,
    borderColor: '#202945',
    borderRadius: 24,
    minHeight: 380,
    padding: 24,
    shadowColor: '#7c4dff',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 4,
  },
  quizCardRevealed: {
    borderColor: '#7c4dff',
  },
  cardInfoStrip: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  cardTopicLabel: {
    color: '#00e5ff',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  cardBodyScroll: {
    flexGrow: 1,
  },
  cardContent: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 12,
  },
  cardPromptText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 26,
    textAlign: 'center',
    marginBottom: 16,
  },
  inputContainer: {
    marginTop: 10,
    width: '100%',
  },
  inputLabel: {
    color: '#90a4ae',
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  answerInput: {
    backgroundColor: '#07080f',
    borderColor: '#202945',
    borderWidth: 1,
    borderRadius: 12,
    color: '#ffffff',
    padding: 12,
    fontSize: 14,
    height: 80,
    textAlignVertical: 'top',
  },
  gradingLoader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#16142c',
    borderRadius: 14,
    marginTop: 16,
  },
  gradingLoaderText: {
    color: '#7c4dff',
    marginLeft: 8,
    fontSize: 12,
    fontWeight: '600',
  },
  revealSection: {
    width: '100%',
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#202945',
    marginVertical: 18,
  },
  cardAnswerLabel: {
    color: '#7c4dff',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 6,
    alignSelf: 'center',
  },
  cardAnswerText: {
    color: '#b0bec5',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  llmFeedbackBox: {
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1f2937',
    borderRadius: 14,
    padding: 14,
    marginTop: 18,
  },
  feedbackHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  feedbackTitle: {
    color: '#00e5ff',
    fontSize: 11,
    fontWeight: '700',
  },
  feedbackText: {
    color: '#d1d5db',
    fontSize: 13,
    lineHeight: 18,
  },
  actionsPanel: {
    padding: 20,
    backgroundColor: 'rgba(7, 8, 15, 0.95)',
    borderTopWidth: 1,
    borderTopColor: '#202945',
  },
  preRevealActions: {
    width: '100%',
  },
  actionButton: {
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    marginBottom: 10,
  },
  gradeLlmButton: {
    backgroundColor: '#7c4dff',
  },
  skipButton: {
    backgroundColor: '#1b223c',
    borderWidth: 1,
    borderColor: '#2d375e',
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  skipButtonText: {
    color: '#90a4ae',
    fontSize: 13,
    fontWeight: '600',
  },
  acceptLlmButton: {
    backgroundColor: '#0284c7',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  gradingContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  gradeButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 4,
  },
  gradeButtonAgain: {
    backgroundColor: '#37474f',
    borderWidth: 1,
    borderColor: '#455a64',
  },
  gradeButtonPartial: {
    backgroundColor: '#d97706',
  },
  gradeButtonMastered: {
    backgroundColor: '#16a34a',
  },
  gradeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  containerCompleted: {
    flex: 1,
    backgroundColor: '#07080f',
    justifyContent: 'center',
    padding: 20,
  },
  successCard: {
    backgroundColor: '#0c0f1d',
    borderWidth: 1,
    borderColor: '#202945',
    borderRadius: 28,
    padding: 32,
    alignItems: 'center',
  },
  successTitle: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 6,
  },
  successSub: {
    color: '#90a4ae',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 24,
  },
  scoreContainer: {
    flexDirection: 'row',
    backgroundColor: '#07080f',
    borderWidth: 1,
    borderColor: '#202945',
    borderRadius: 20,
    padding: 16,
    width: '100%',
    marginBottom: 20,
  },
  scoreCell: {
    flex: 1,
    alignItems: 'center',
  },
  scoreValue: {
    color: '#00e5ff',
    fontSize: 24,
    fontWeight: '800',
  },
  scoreLabel: {
    color: '#90a4ae',
    fontSize: 11,
    marginTop: 4,
  },
  streakNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#26120c',
    borderWidth: 1,
    borderColor: '#ff5722',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginBottom: 24,
    width: '100%',
    justifyContent: 'center',
  },
  streakNoticeText: {
    color: '#ff5722',
    fontWeight: '700',
    fontSize: 13,
  },
  finishButton: {
    backgroundColor: '#7c4dff',
    borderRadius: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  finishButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    marginRight: 8,
  },
});
