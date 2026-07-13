import React, { useState } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TouchableOpacity, 
  SafeAreaView, 
  Alert,
  ScrollView
} from 'react-native';
import { Flame, Sparkles, Award, ArrowRight, RotateCcw, AlertTriangle } from 'lucide-react-native';

import { getUser } from '../utils/storage';
import { updateMastery } from '../utils/workflowClient';

export default function QuizScreen({ route, navigation }) {
  const { deck } = route.params;
  const cards = deck?.cards || [];
  const concepts = deck?.concepts || [];
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [sessionScores, setSessionScores] = useState({});
  const [quizCompleted, setQuizCompleted] = useState(false);
  
  // Track final summary stats
  const [correctCount, setCorrectCount] = useState(0);

  const getConceptName = (conceptId) => {
    const concept = concepts.find(c => c.id === conceptId);
    return concept ? concept.name : 'Topic';
  };

  const handleReveal = () => {
    setRevealed(true);
  };

  const handleScore = async (scoreValue) => {
    const card = cards[currentIndex];
    const concept = concepts.find(c => c.id === card.conceptId);
    const topicId = concept ? concept.canonicalTopic : card.conceptId;

    // Track score locally for end-of-session submission
    setSessionScores(prev => ({
      ...prev,
      [topicId]: scoreValue
    }));

    if (scoreValue >= 0.7) {
      setCorrectCount(prev => prev + 1);
    }

    // Go to next card or complete
    if (currentIndex < cards.length - 1) {
      setRevealed(false);
      setCurrentIndex(prev => prev + 1);
    } else {
      await finalizeQuizSession({ ...sessionScores, [topicId]: scoreValue });
    }
  };

  const finalizeQuizSession = async (finalScores) => {
    try {
      const user = await getUser();
      
      // Update mastery scores on the backend for each topic studied
      for (const [topicId, score] of Object.entries(finalScores)) {
        await updateMastery(user.id, topicId, score);
      }
      
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
            {!revealed ? (
              <View style={styles.cardContent}>
                <Text style={styles.cardPromptText}>{currentCard?.front}</Text>
              </View>
            ) : (
              <View style={styles.cardContent}>
                <Text style={styles.cardPromptText}>{currentCard?.front}</Text>
                <View style={styles.cardDivider} />
                <Text style={styles.cardAnswerLabel}>ANSWER</Text>
                <Text style={styles.cardAnswerText}>{currentCard?.back}</Text>
              </View>
            )}
          </ScrollView>
        </View>
      </View>

      {/* ACTION PANEL */}
      <View style={styles.actionsPanel}>
        {!revealed ? (
          <TouchableOpacity style={styles.revealButton} onPress={handleReveal}>
            <Sparkles color="#ffffff" size={20} style={{ marginRight: 8 }} />
            <Text style={styles.revealText}>Reveal Answer</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.gradingContainer}>
            <TouchableOpacity 
              style={[styles.gradeButton, styles.gradeButtonAgain]}
              onPress={() => handleScore(0.3)}
            >
              <RotateCcw color="#ffffff" size={18} style={{ marginRight: 6 }} />
              <Text style={styles.gradeText}>Review Again</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.gradeButton, styles.gradeButtonMastered]}
              onPress={() => handleScore(1.0)}
            >
              <Flame color="#ffffff" size={18} style={{ marginRight: 6 }} />
              <Text style={styles.gradeText}>Mastered! ⚡</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
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
    minHeight: 280,
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
  actionsPanel: {
    padding: 20,
    backgroundColor: 'rgba(7, 8, 15, 0.95)',
    borderTopWidth: 1,
    borderTopColor: '#202945',
  },
  revealButton: {
    backgroundColor: '#7c4dff',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  revealText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  gradingContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  gradeButton: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 6,
  },
  gradeButtonAgain: {
    backgroundColor: '#37474f',
    borderWidth: 1,
    borderColor: '#455a64',
  },
  gradeButtonMastered: {
    backgroundColor: '#4caf50',
  },
  gradeText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
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
