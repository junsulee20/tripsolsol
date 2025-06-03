import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import TabLayout from '../../components/TabLayout';
import { onAuthStateChange, getUserTrips } from '../../services/firebaseService';
import { Trip, Member } from '../../types';
import { CURRENCIES } from '../../constants/Currency';

const mockGroups = [
  { id: '1', name: '21학번 동기 유럽 여행', icon: 'airplane', color: '#4A90E2' },
  { id: '2', name: '오사카 커플 여행', icon: 'heart', color: '#FF6B6B' },
  { id: '3', name: '8.21-8.23 학술 컨퍼런스', icon: 'school', color: '#FFA726' },
  { id: '4', name: '베트남 다낭', icon: 'airplane', color: '#4A90E2' },
];

export default function AddExpenseScreen() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    // Auth state listener 설정
    const unsubscribe = onAuthStateChange((user) => {
      setCurrentUser(user);
      if (user) {
        fetchTrips(user.uid);
      } else {
        // 로그인되지 않은 경우 로그인 페이지로 이동
        router.replace('/auth/login');
      }
    });

    return unsubscribe;
  }, []);

  const fetchTrips = async (userId: string) => {
    try {
      setLoading(true);
      // 본인이 포함된 모든 여행을 가져오기
      const tripsFromDB = await getUserTrips(userId);
      setTrips(tripsFromDB);
    } catch (error) {
      console.error('Error fetching trips:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTrip = (trip: Trip) => {
    router.push({
      pathname: '/expense/camera',
      params: { tripId: trip.id, tripName: trip.name }
    });
  };

  const renderTripItem = ({ item }: { item: Trip }) => (
    <TouchableOpacity
      style={styles.tripItem}
      onPress={() => handleSelectTrip(item)}
    >
      <View style={[styles.tripIcon, { backgroundColor: '#4A90E2' }]}>
        <Text style={styles.tripEmoji}>{item.emoji || '✈️'}</Text>
      </View>
      <View style={styles.tripInfo}>
        <Text style={styles.tripName}>{item.name}</Text>
        <Text style={styles.tripSubtitle}>
          {item.startDate?.toLocaleDateString?.() || ''}
          {item.endDate ? ` ~ ${item.endDate.toLocaleDateString?.()}` : ''}
        </Text>
        <Text style={styles.participantsCount}>
          참가자 {item.participants?.length || 0}명
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#666" />
    </TouchableOpacity>
  );

  return (
    <TabLayout>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>지출 추가할 여행 선택</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.content}>
        <View style={styles.instructionContainer}>
          <Text style={styles.instructionText}>
            지출을 추가할 여행을 선택해주세요
          </Text>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#4A90E2" />
            <Text style={styles.loadingText}>여행 목록을 불러오는 중...</Text>
          </View>
        ) : trips.length > 0 ? (
          <FlatList
            data={trips}
            renderItem={renderTripItem}
            keyExtractor={item => item.id}
            style={styles.tripsList}
            showsVerticalScrollIndicator={false}
          />
        ) : (
          <View style={styles.emptyContainer}>
            <Ionicons name="airplane-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>참여 중인 여행이 없습니다</Text>
            <Text style={styles.emptySubtext}>새로운 여행을 만들어보세요!</Text>
            <TouchableOpacity 
              style={styles.createTripButton}
              onPress={() => router.push('/trip/create')}
            >
              <Ionicons name="add" size={20} color="white" />
              <Text style={styles.createTripButtonText}>새 여행 만들기</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </TabLayout>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  backButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  placeholder: {
    width: 32,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  instructionContainer: {
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  instructionText: {
    fontSize: 16,
    color: '#1976D2',
    textAlign: 'center',
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 18,
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
    fontWeight: '600',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    marginBottom: 24,
    textAlign: 'center',
  },
  createTripButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4A90E2',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
  },
  createTripButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
  },
  tripsList: {
    flex: 1,
  },
  tripItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 2,
  },
  tripIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  tripEmoji: {
    fontSize: 24,
  },
  tripInfo: {
    flex: 1,
  },
  tripName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  tripSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  participantsCount: {
    fontSize: 12,
    color: '#4A90E2',
    fontWeight: '500',
  },
}); 