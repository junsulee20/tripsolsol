import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import TabLayout from '../../components/TabLayout';
import { getUserTrips, getCurrentUser } from '../../services/firebaseService';
import { Trip } from '../../types';

export default function AddExpenseScreen() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUserTrips();
  }, []);

  const fetchUserTrips = async () => {
    try {
      setLoading(true);
      const currentUser = getCurrentUser();
      
      if (!currentUser) {
        Alert.alert('오류', '로그인이 필요합니다.');
        router.replace('/auth/login');
        return;
      }

      const userTrips = await getUserTrips(currentUser.uid);
      setTrips(userTrips);
    } catch (error) {
      console.error('Error fetching trips:', error);
      Alert.alert('오류', '여행 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTrip = (trip: Trip) => {
    router.push({
      pathname: '/expense/detail',
      params: { tripId: trip.id, tripName: trip.name }
    });
  };

  const getTripIcon = (trip: Trip) => {
    // 여행의 이모지가 있으면 사용, 없으면 기본 아이콘
    if (trip.emoji) {
      return trip.emoji;
    }
    return 'airplane';
  };

  const getTripColor = (tripId: string) => {
    const colors = ['#4A90E2', '#FF6B6B', '#FFA726', '#4ECDC4', '#96CEB4'];
    const index = tripId.charCodeAt(0) % colors.length;
    return colors[index];
  };

  const renderTripItem = ({ item }: { item: Trip }) => (
    <TouchableOpacity
      style={styles.groupItem}
      onPress={() => handleSelectTrip(item)}
    >
      <View style={[styles.groupIcon, { backgroundColor: getTripColor(item.id) }]}>
        {item.emoji ? (
          <Text style={styles.emojiIcon}>{item.emoji}</Text>
        ) : (
          <Ionicons name="airplane" size={20} color="white" />
        )}
      </View>
      <View style={styles.groupInfo}>
        <Text style={styles.groupName}>{item.name}</Text>
        <Text style={styles.groupDescription}>
          {new Date(item.startDate).toLocaleDateString()} - {new Date(item.endDate).toLocaleDateString()}
        </Text>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <TabLayout>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>지출 추가할 여행 선택</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4A90E2" />
          <Text style={styles.loadingText}>여행 목록 불러오는 중...</Text>
        </View>
      </TabLayout>
    );
  }

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

        {trips.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="airplane-outline" size={50} color="#ccc" />
            <Text style={styles.emptyText}>등록된 여행이 없습니다</Text>
            <TouchableOpacity 
              style={styles.createTripButton}
              onPress={() => router.push('/trip/create')}
            >
              <Text style={styles.createTripButtonText}>새 여행 만들기</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={trips}
            renderItem={renderTripItem}
            keyExtractor={item => item.id}
            style={styles.groupsList}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </TabLayout>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: 'white',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  instructionContainer: {
    padding: 20,
    backgroundColor: 'white',
    marginBottom: 20,
  },
  instructionText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  groupsList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  groupItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'white',
    marginBottom: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  groupIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  emojiIcon: {
    fontSize: 20,
  },
  groupInfo: {
    flex: 1,
  },
  groupName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  groupDescription: {
    fontSize: 14,
    color: '#666',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
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
    fontSize: 16,
    color: '#666',
    marginTop: 12,
    marginBottom: 20,
    textAlign: 'center',
  },
  createTripButton: {
    backgroundColor: '#4A90E2',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  createTripButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
}); 