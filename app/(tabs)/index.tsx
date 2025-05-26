import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  RefreshControl,
  Image
} from 'react-native';
import { router } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../../config/firebase';
import { getUserTrips, logout } from '../../services/firebaseService';
import { Trip } from '../../types';
import { Ionicons } from '@expo/vector-icons';

export default function HomeScreen() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUser(user);
        loadTrips(user.uid);
      } else {
        router.replace('/auth/login');
      }
    });

    return unsubscribe;
  }, []);

  const loadTrips = async (userId: string) => {
    try {
      const userTrips = await getUserTrips(userId);
      setTrips(userTrips);
    } catch (error) {
      console.error('Error loading trips:', error);
      Alert.alert('오류', '여행 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    if (user) {
      setRefreshing(true);
      loadTrips(user.uid);
    }
  };

  const handleProfilePress = () => {
    router.push('/profile/settings');
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('ko-KR', {
      month: 'short',
      day: 'numeric'
    });
  };

  const getGroupIcon = (index: number) => {
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD'];
    return colors[index % colors.length];
  };

  const renderTripItem = ({ item, index }: { item: Trip; index: number }) => (
    <TouchableOpacity
      style={styles.groupCard}
      onPress={() => router.push(`/trip/${item.id}`)}
    >
      <View style={styles.groupHeader}>
        <View style={[styles.groupIcon, { backgroundColor: getGroupIcon(index) }]}>
          <Ionicons name="people" size={20} color="white" />
        </View>
        <View style={styles.groupInfo}>
          <Text style={styles.groupName}>{item.name}</Text>
          <Text style={styles.groupMembers}>{item.participants.length}명</Text>
        </View>
        <View style={styles.groupAmount}>
          <Text style={styles.amountText}>
            ₩{item.totalAmount.toLocaleString()}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <View style={styles.emptyIcon}>
        <View style={styles.iconBackground}>
          <Ionicons name="people-outline" size={40} color="#4A90E2" />
        </View>
      </View>
      <Text style={styles.emptyTitle}>김윤정님, 환영합니다!</Text>
      <Text style={styles.emptySubtitle}>
        groups you create or are{'\n'}added to will show here.
      </Text>
      <TouchableOpacity
        style={styles.createGroupButton}
        onPress={() => router.push('/trip/create')}
      >
        <Ionicons name="add" size={16} color="#4A90E2" />
        <Text style={styles.createGroupText}>그룹 추가하기</Text>
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text>로딩 중...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleProfilePress} style={styles.profileButton}>
          <View style={styles.profileIcon}>
            <Text style={styles.profileText}>김</Text>
          </View>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>그룹</Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity 
            style={styles.travelButton}
            onPress={() => router.push('/travel/list')}
          >
            <Ionicons name="airplane" size={20} color="#4A90E2" />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.addButton}
            onPress={() => router.push('/trip/create')}
          >
            <Ionicons name="add" size={24} color="#4A90E2" />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={trips}
        renderItem={renderTripItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={trips.length === 0 ? styles.emptyContainer : styles.listContainer}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
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
  },
  profileButton: {
    width: 32,
    height: 32,
  },
  profileIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#4A90E2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  travelButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContainer: {
    padding: 0,
  },
  emptyContainer: {
    flex: 1,
  },
  groupCard: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  groupIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  groupInfo: {
    flex: 1,
  },
  groupName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  groupMembers: {
    fontSize: 14,
    color: '#666',
  },
  groupAmount: {
    alignItems: 'flex-end',
  },
  amountText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIcon: {
    marginBottom: 24,
  },
  iconBackground: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 32,
  },
  createGroupButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#4A90E2',
    backgroundColor: 'white',
  },
  createGroupText: {
    fontSize: 14,
    color: '#4A90E2',
    fontWeight: '500',
    marginLeft: 6,
  },
});
