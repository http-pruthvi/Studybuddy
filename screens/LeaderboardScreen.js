import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  FlatList, 
  ActivityIndicator, 
  SafeAreaView, 
  TouchableOpacity,
  Share 
} from 'react-native';
import { Trophy, Flame, Share2, Users, Award, ShieldCheck } from 'lucide-react-native';

import { getUser } from '../utils/storage';
import { getLeaderboard } from '../utils/workflowClient';

export default function LeaderboardScreen({ route }) {
  const { classroomId } = route.params;
  const [loading, setLoading] = useState(true);
  const [leaderboard, setLeaderboard] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    loadLeaderboard();
  }, []);

  const loadLeaderboard = async () => {
    setLoading(true);
    try {
      const user = await getUser();
      setCurrentUser(user);

      const board = await getLeaderboard(classroomId);
      setLeaderboard(board || []);
    } catch (err) {
      console.warn("Failed to load classroom leaderboard:", err);
      setLeaderboard([]);
    } finally {
      setLoading(false);
    }
  };

  const handleShareCode = async () => {
    try {
      await Share.share({
        message: `Join my StudyBuddy classroom! Use the code: ${classroomId}`,
      });
    } catch (error) {
      console.error(error.message);
    }
  };

  const renderLeaderboardItem = ({ item, index }) => {
    const isMe = item.userId === currentUser?.id;
    const rankColors = ['#ffd700', '#c0c0c0', '#cd7f32']; // Gold, Silver, Bronze
    
    return (
      <View style={[
        styles.rowItem,
        isMe && styles.rowItemMe
      ]}>
        {/* RANK NUMBER */}
        <View style={styles.rankCell}>
          {index < 3 ? (
            <Trophy color={rankColors[index]} size={20} fill={rankColors[index]} />
          ) : (
            <Text style={styles.rankNumberText}>{index + 1}</Text>
          )}
        </View>

        {/* NAME AND DETAILS */}
        <View style={styles.detailsCell}>
          <Text style={[
            styles.userNameText,
            isMe && styles.userNameTextMe
          ]}>{item.userName}</Text>
          
          <View style={styles.badgeRow}>
            <Award color="#90a4ae" size={10} style={{ marginRight: 4 }} />
            <Text style={styles.badgeText}>{item.masteredCount} topics mastered</Text>
          </View>
        </View>

        {/* STREAK */}
        <View style={styles.streakCell}>
          <Flame color={item.streak > 0 ? "#ff5722" : "#90a4ae"} size={16} style={{ marginRight: 4 }} />
          <Text style={styles.streakText}>{item.streak} days</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      
      {/* CLASS DETAILS BANNER */}
      <View style={styles.banner}>
        <View style={styles.bannerHeader}>
          <Users color="#00e5ff" size={24} style={{ marginRight: 10 }} />
          <Text style={styles.bannerTitle}>Classroom: {classroomId}</Text>
        </View>
        
        <View style={styles.bannerInfoRow}>
          <ShieldCheck color="#4caf50" size={12} style={{ marginRight: 6 }} />
          <Text style={styles.anonymityNotice}>Leaderboard shows display names for peer motivation — teacher heatmap uses anonymized aliases</Text>
        </View>

        <TouchableOpacity style={styles.shareButton} onPress={handleShareCode}>
          <Share2 color="#ffffff" size={14} style={{ marginRight: 6 }} />
          <Text style={styles.shareButtonText}>Share Code</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#7c4dff" />
        </View>
      ) : (
        <FlatList
          data={leaderboard}
          keyExtractor={(item) => item.userId}
          renderItem={renderLeaderboardItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Trophy color="#546e7a" size={48} style={{ marginBottom: 12 }} />
              <Text style={styles.emptyText}>No classmate study records found.</Text>
              <Text style={styles.emptySubText}>Invite classmates to study together using the code above!</Text>
            </View>
          }
        />
      )}

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#07080f',
  },
  banner: {
    backgroundColor: '#0c0f1d',
    borderBottomWidth: 1,
    borderBottomColor: '#202945',
    padding: 20,
    alignItems: 'center',
  },
  bannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  bannerTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
  bannerInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  anonymityNotice: {
    color: '#90a4ae',
    fontSize: 10,
    fontWeight: '600',
  },
  shareButton: {
    backgroundColor: '#261c47',
    borderWidth: 1,
    borderColor: '#7c4dff',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  shareButtonText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 16,
  },
  rowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0c0f1d',
    borderWidth: 1,
    borderColor: '#202945',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  rowItemMe: {
    borderColor: '#7c4dff',
    backgroundColor: '#16142c',
  },
  rankCell: {
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankNumberText: {
    color: '#90a4ae',
    fontSize: 14,
    fontWeight: '700',
  },
  detailsCell: {
    flex: 1,
    paddingLeft: 12,
  },
  userNameText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  userNameTextMe: {
    fontWeight: '800',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  badgeText: {
    color: '#90a4ae',
    fontSize: 10,
  },
  streakCell: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    width: 70,
  },
  streakText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 40,
  },
  emptyText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptySubText: {
    color: '#90a4ae',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 6,
    paddingHorizontal: 24,
  },
});
