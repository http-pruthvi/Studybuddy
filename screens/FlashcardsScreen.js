import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TouchableOpacity, 
  FlatList, 
  SafeAreaView,
  ActivityIndicator
} from 'react-native';
import { ArrowRight, BookOpen, AlertCircle, Sparkles, Filter } from 'lucide-react-native';

import { getUser } from '../utils/storage';
import { getUserGraph } from '../utils/workflowClient';

export default function FlashcardsScreen({ route, navigation }) {
  const { deck } = route.params;
  const cards = deck?.cards || [];
  const concepts = deck?.concepts || [];

  const [flipped, setFlipped] = useState({});
  const [masteryScores, setMasteryScores] = useState({});
  const [loadingScores, setLoadingScores] = useState(true);
  const [filterWeak, setFilterWeak] = useState(false);

  useEffect(() => {
    loadMasteryScores();
  }, []);

  const loadMasteryScores = async () => {
    try {
      const user = await getUser();
      if (user) {
        const graph = await getUserGraph(user.id);
        const scores = {};
        graph.nodes.forEach(node => {
          scores[node.label.toLowerCase()] = node.score;
        });
        setMasteryScores(scores);
      }
    } catch (e) {
      console.warn("Failed to load mastery scores for flashcards:", e);
    } finally {
      setLoadingScores(false);
    }
  };

  const getConceptName = (conceptId) => {
    const concept = concepts.find(c => c.id === conceptId);
    return concept ? concept.name : 'General';
  };

  const getCardMastery = (conceptId) => {
    const concept = concepts.find(c => c.id === conceptId);
    if (!concept) return null;
    
    // Check canonical topic first, then concept name
    const key = (concept.canonicalTopic || concept.name || "").toLowerCase().trim();
    return masteryScores[key] !== undefined ? masteryScores[key] : null;
  };

  const toggleFlip = (index) => {
    setFlipped(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  const getFilteredCards = () => {
    if (!filterWeak) return cards;
    return cards.filter(card => {
      const score = getCardMastery(card.conceptId);
      // Weak cards = score < 0.7 or never reviewed (score is null)
      return score === null || score < 0.7;
    });
  };

  const handleStartQuiz = (cardsToQuiz) => {
    const quizDeck = {
      ...deck,
      cards: cardsToQuiz
    };
    navigation.navigate('Quiz', { deck: quizDeck });
  };

  const renderCardItem = ({ item, index }) => {
    const isFlipped = !!flipped[index];
    const score = getCardMastery(item.conceptId);
    
    let dotColor = '#90a4ae'; // Grey (not reviewed)
    let statusText = 'Not Reviewed';
    if (score !== null) {
      statusText = `Mastery: ${(score * 100).toFixed(0)}%`;
      if (score >= 0.7) {
        dotColor = '#16a34a'; // Green
      } else if (score >= 0.4) {
        dotColor = '#d97706'; // Amber
      } else {
        dotColor = '#dc2626'; // Red
      }
    }

    return (
      <TouchableOpacity 
        style={[styles.cardItem, isFlipped && styles.cardItemFlipped]} 
        onPress={() => toggleFlip(index)}
        activeOpacity={0.9}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.cardIndex}>Card #{index + 1}</Text>
          <View style={styles.conceptBadge}>
            <Text style={styles.conceptBadgeText}>
              🏷️ {getConceptName(item.conceptId)}
            </Text>
          </View>
        </View>
        
        <View style={styles.divider} />
        
        {!isFlipped ? (
          <View style={styles.cardBody}>
            <Text style={styles.cardQuestionLabel}>QUESTION (Tap to flip):</Text>
            <Text style={styles.cardQuestion}>{item.front}</Text>
          </View>
        ) : (
          <View style={styles.cardBody}>
            <Text style={styles.cardAnswerLabel}>ANSWER (Tap to flip):</Text>
            <Text style={styles.cardAnswer}>{item.back}</Text>
          </View>
        )}

        <View style={styles.cardFooter}>
          <View style={styles.masteryIndicator}>
            <View style={[styles.masteryDot, { backgroundColor: dotColor }]} />
            <Text style={styles.masteryText}>{statusText}</Text>
          </View>
          <Text style={styles.flipHint}>{isFlipped ? "Showing Answer" : "Tap to Flip"}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const filteredCards = getFilteredCards();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <View style={styles.headerTitleGroup}>
            <BookOpen color="#7c4dff" size={24} style={{ marginRight: 10 }} />
            <Text style={styles.deckTitle} numberOfLines={1}>{deck?.title}</Text>
          </View>
          
          <TouchableOpacity 
            style={[styles.filterButton, filterWeak && styles.filterButtonActive]}
            onPress={() => setFilterWeak(prev => !prev)}
          >
            <Filter color={filterWeak ? '#00e5ff' : '#90a4ae'} size={16} style={{ marginRight: 6 }} />
            <Text style={[styles.filterButtonText, filterWeak && styles.filterButtonTextActive]}>
              {filterWeak ? "Weak/New Only" : "All Cards"}
            </Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.deckSubtitle}>
          Showing {filteredCards.length} of {cards.length} cards
        </Text>
      </View>

      {loadingScores ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#7c4dff" />
          <Text style={styles.loadingText}>Syncing mastery details...</Text>
        </View>
      ) : filteredCards.length === 0 ? (
        <View style={styles.emptyContainer}>
          <AlertCircle color="#90a4ae" size={48} style={{ marginBottom: 12 }} />
          <Text style={styles.emptyText}>No cards matching filter.</Text>
          {filterWeak && (
            <Text style={styles.emptySubText}>Congratulations! You have mastered all cards in this deck.</Text>
          )}
        </View>
      ) : (
        <FlatList
          data={filteredCards}
          keyExtractor={(item, index) => `card-${index}`}
          renderItem={renderCardItem}
          contentContainerStyle={styles.listContent}
        />
      )}

      {/* FLOAT CTA TO START QUIZ */}
      {filteredCards.length > 0 && (
        <View style={styles.footer}>
          <TouchableOpacity 
            style={styles.quizButton}
            onPress={() => handleStartQuiz(filteredCards)}
          >
            <Text style={styles.quizButtonText}>
              Start Quiz ({filteredCards.length} Cards)
            </Text>
            <ArrowRight color="#ffffff" size={18} />
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#07080f',
  },
  header: {
    padding: 20,
    backgroundColor: '#0c0f1d',
    borderBottomWidth: 1,
    borderBottomColor: '#202945',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  deckTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1b223c',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2d375e',
  },
  filterButtonActive: {
    borderColor: '#00e5ff',
    backgroundColor: '#061726',
  },
  filterButtonText: {
    color: '#90a4ae',
    fontSize: 11,
    fontWeight: '700',
  },
  filterButtonTextActive: {
    color: '#00e5ff',
  },
  deckSubtitle: {
    color: '#90a4ae',
    fontSize: 12,
    marginTop: 4,
    paddingLeft: 34,
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  cardItem: {
    backgroundColor: '#0c0f1d',
    borderWidth: 1,
    borderColor: '#202945',
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
  },
  cardItemFlipped: {
    borderColor: '#7c4dff',
    backgroundColor: '#13112c',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardIndex: {
    color: '#7c4dff',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  conceptBadge: {
    backgroundColor: '#1b223c',
    borderWidth: 1,
    borderColor: '#2d375e',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  conceptBadgeText: {
    color: '#00e5ff',
    fontSize: 10,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: '#202945',
    marginBottom: 14,
  },
  cardBody: {
    minHeight: 80,
    justifyContent: 'center',
  },
  cardQuestionLabel: {
    color: '#90a4ae',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  cardQuestion: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
    marginTop: 4,
    lineHeight: 22,
  },
  cardAnswerLabel: {
    color: '#7c4dff',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  cardAnswer: {
    color: '#e2e8f0',
    fontSize: 14,
    marginTop: 4,
    lineHeight: 20,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#202945',
  },
  masteryIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  masteryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  masteryText: {
    color: '#90a4ae',
    fontSize: 11,
    fontWeight: '600',
  },
  flipHint: {
    color: '#7c4dff',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    color: '#90a4ae',
    fontSize: 13,
    marginTop: 10,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    color: '#90a4ae',
    fontSize: 15,
    fontWeight: '600',
  },
  emptySubText: {
    color: '#607d8b',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: 'rgba(7, 8, 15, 0.95)',
    borderTopWidth: 1,
    borderTopColor: '#202945',
  },
  quizButton: {
    backgroundColor: '#7c4dff',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    shadowColor: '#7c4dff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  quizButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    marginRight: 8,
  },
});
