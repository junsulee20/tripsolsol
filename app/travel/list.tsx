import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  RefreshControl
} from 'react-native';
import { getUserTrips, getCurrentUser, onAuthStateChange, testFirebaseConnection } from '../../services/firebaseService';
import { Trip } from '../../types';

export default function TravelListScreen() {
  const [user, setUser] = useState<{ name: string; avatar: string } | null>(null);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    console.log('TravelListScreen useEffect triggered');
    
    // Firebase 연결 테스트
    testFirebaseConnection();
    
    // 현재 인증된 사용자가 있는지 즉시 확인
    const currentUser = getCurrentUser();
    if (currentUser) {
      console.log('Already authenticated user found:', currentUser.uid);
      setUser({
        name: currentUser.displayName || '사용자',
        avatar: currentUser.displayName?.charAt(0) || '사'
      });
      loadTrips(currentUser.uid);
    }
    
    // 인증 상태 변화 감지
    const unsubscribe = onAuthStateChange((firebaseUser) => {
      console.log('Auth state changed:', firebaseUser ? firebaseUser.uid : 'No user');
      
      if (firebaseUser) {
        console.log('User authenticated:', {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName
        });
        
        setUser({
          name: firebaseUser.displayName || '사용자',
          avatar: firebaseUser.displayName?.charAt(0) || '사'
        });
        loadTrips(firebaseUser.uid);
      } else {
        console.log('No authenticated user, redirecting to login');
        // 로그인되지 않은 경우 로그인 페이지로 이동
        router.replace('/auth/login');
      }
    });

    return unsubscribe;
  }, []);

  const loadTrips = async (userId: string) => {
    try {
      console.log('loadTrips called with userId:', userId);
      setLoading(true);
      
      const userTrips = await getUserTrips(userId);
      console.log('getUserTrips returned:', userTrips);
      
      setTrips(userTrips);
      console.log('Trips state updated, count:', userTrips.length);
    } catch (error) {
      console.error('Error loading trips:', error);
      Alert.alert('오류', '여행 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
      setRefreshing(false);
      console.log('Loading completed');
    }
  };

  const onRefresh = () => {
    console.log('Refresh triggered');
    const currentUser = getCurrentUser();
    console.log('Current user for refresh:', currentUser ? currentUser.uid : 'No user');
    
    if (currentUser) {
      setRefreshing(true);
      loadTrips(currentUser.uid);
    }
  };

  // 정산 금액 계산 함수 (임시 - 실제로는 expenses를 기반으로 계산)
  const calculateTripBalance = (tripId: string) => {
    // 임시로 랜덤 값 반환 (나중에 실제 expense 데이터로 계산)
    const randomBalance = Math.floor(Math.random() * 200) - 100;
    return {
      netBalance: randomBalance,
      formattedBalance: randomBalance >= 0 ? `+₩${Math.abs(randomBalance).toLocaleString()}` : `-₩${Math.abs(randomBalance).toLocaleString()}`
    };
  };

  const handleAddTravel = () => {
    router.push('/trip/create');
  };

  const handleTravelPress = (travel: Trip) => {
    router.push(`/trip/${travel.id}`);
  };

  const renderTravelItem = (travel: Trip) => {
    const { formattedBalance } = calculateTripBalance(travel.id);
    
    return (
      <TouchableOpacity
        key={travel.id}
        style={styles.travelItem}
        onPress={() => handleTravelPress(travel)}
      >
        <View style={styles.travelInfo}>
          <Text style={styles.travelFlag}>{travel.emoji || '✈️'}</Text>
          <View style={styles.travelDetails}>
            <Text style={styles.travelCountry}>{travel.name}</Text>
            <Text style={styles.travelDate}>
              {travel.startDate.toLocaleDateString('ko-KR')}
              {travel.endDate ? ` ~ ${travel.endDate.toLocaleDateString('ko-KR')}` : ''}
            </Text>
          </View>
        </View>
        <View style={styles.amountContainer}>
          <Text style={styles.travelAmount}>
            ₩{travel.totalAmount?.toLocaleString?.() || '0'}
          </Text>
          <Text style={[
            styles.balanceAmount,
            { color: formattedBalance.startsWith('+') ? '#27ae60' : '#e74c3c' }
          ]}>
            {formattedBalance}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <View style={styles.emptyIcon}>
        <View style={styles.iconBackground}>
          <Ionicons name="airplane-outline" size={40} color="#4A90E2" />
        </View>
      </View>
      <Text style={styles.emptyTitle}>{user?.name || '사용자'}님, 환영합니다!</Text>
      <Text style={styles.emptySubtitle}>
        첫 번째 여행을 만들어보세요!
      </Text>
      <TouchableOpacity style={styles.createTravelButton} onPress={handleAddTravel}>
        <Ionicons name="add" size={16} color="#4A90E2" />
        <Text style={styles.createTravelText}>새로운 여행 추가하기</Text>
      </TouchableOpacity>
    </View>
  );

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>로딩 중...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.userInfo}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user?.avatar || '사'}</Text>
          </View>
          <View style={styles.userTextContainer}>
            <Text style={styles.userName}>{user?.name || '사용자'}</Text>
            <Text style={styles.subtitle}>정산할 여행을 선택해주세요!</Text>
          </View>
        </View>
        <View style={styles.headerButtons}>
          <TouchableOpacity 
            style={styles.refreshButton}
            onPress={onRefresh}
          >
            <Ionicons name="refresh" size={20} color="#4A90E2" />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.addButton}
            onPress={handleAddTravel}
          >
            <Ionicons name="add" size={24} color="#4A90E2" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>여행 목록</Text>
          <View style={styles.travelsList}>
            {trips.length > 0 ? (
              trips.map(renderTravelItem)
            ) : (
              renderEmptyState()
            )}
          </View>
          
          {trips.length > 0 && (
            <TouchableOpacity style={styles.addTravelButton} onPress={handleAddTravel}>
              <Ionicons name="add" size={16} color="#4A90E2" />
              <Text style={styles.addTravelText}>새로운 여행 추가하기</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
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
    backgroundColor: '#F8F9FA',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
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
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FF6B6B',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  userTextContainer: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  travelsList: {
    marginBottom: 20,
  },
  travelItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  travelInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  travelFlag: {
    fontSize: 24,
    marginRight: 12,
  },
  travelDetails: {
    flex: 1,
  },
  travelCountry: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  travelDate: {
    fontSize: 14,
    color: '#666',
  },
  amountContainer: {
    alignItems: 'flex-end',
  },
  travelAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  balanceAmount: {
    fontSize: 14,
    fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyIcon: {
    marginBottom: 20,
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
    fontSize: 22,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
  },
  createTravelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
  },
  createTravelText: {
    fontSize: 16,
    color: '#4A90E2',
    marginLeft: 8,
    fontWeight: '600',
  },
  addTravelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E3F2FD',
    borderStyle: 'dashed',
  },
  addTravelText: {
    fontSize: 16,
    color: '#4A90E2',
    marginLeft: 8,
    fontWeight: '600',
  },
}); 