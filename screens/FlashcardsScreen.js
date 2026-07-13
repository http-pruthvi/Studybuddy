import React from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TouchableOpacity, 
  FlatList, 
  SafeAreaView 
} from 'react-native';
import { ArrowRight, BookOpen, AlertCircle } from 'lucide-react-native';

export default function FlashcardsScreen({ route, navigation }) {
  const { deck } = route.params;
  const cards = deck?.cards || [];
  const concepts = deck?.concepts || [];

  const getConceptName = (conceptId) => {
    const concept = concepts.find(c => c.id === conceptId);
    return concept ? concept.name : 'General';
  };

  const renderCardItem = ({ item, index }) => (
    <View style={styles.cardItem}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardIndex}>Card #{index + 1}</Text>
        <View style={styles.conceptBadge}>
          <Text style={styles.conceptBadgeText}>
            🏷️ {getConceptName(item.conceptId)}
          </Text>
        </View>
      </View>
      
      <View style={styles.divider} />
      
      <Text style={styles.cardQuestionLabel}>QUESTION:</Text>
      <Text style={styles.cardQuestion}>{item.front}</Text>
      
      <Text style={styles.cardAnswerLabel}>ANSWER:</Text>
      <Text style={styles.cardAnswer}>{item.back}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTitleGroup}>
          <BookOpen color="#7c4dff" size={24} style={{ marginRight: 10 }} />
          <Text style={styles.deckTitle} numberOfLines={1}>{deck?.title}</Text>
        </View>
        <Text style={styles.deckSubtitle}>{cards.length} Flashcards in this deck</Text>
      </View>

      {cards.length === 0 ? (
        <View style={styles.emptyContainer}>
          <AlertCircle color="#90a4ae" size={48} style={{ marginBottom: 12 }} />
          <Text style={styles.emptyText}>No cards in this deck.</Text>
        </View>
      ) : (
        <FlatList
          data={cards}
          keyExtractor={(item, index) => `card-${index}`}
          renderItem={renderCardItem}
          contentContainerStyle={styles.listContent}
        />
      )}

      {/* FLOAT CTA TO START QUIZ */}
      {cards.length > 0 && (
        <View style={styles.footer}>
          <TouchableOpacity 
            style={styles.quizButton}
            onPress={() => navigation.navigate('Quiz', { deck })}
          >
            <Text style={styles.quizButtonText}>Start Active Recall Quiz</Text>
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
  headerTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deckTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
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
    marginBottom: 16,
  },
  cardAnswerLabel: {
    color: '#7c4dff',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  cardAnswer: {
    color: '#b0bec5',
    fontSize: 14,
    marginTop: 4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    color: '#90a4ae',
    fontSize: 16,
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
