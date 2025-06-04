import { Ionicons } from '@expo/vector-icons';
import { router, useNavigation } from 'expo-router';
import React, { useEffect, useState, useCallback } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  RefreshControl,
  Image,
  Platform
} from 'react-native';
import { getUserTrips, getCurrentUser, onAuthStateChange, testFirebaseConnection, getTripExpenses } from '../../services/firebaseService';
import { Trip, Expense } from '../../types';
import TabLayout from '../../components/TabLayout';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// 캐릭터 이미지 목록 및 키값
const characterKeys = ['bear', 'dino', 'dog', 'koala', 'cat'];
const characterImages = [
  require('../../assets/images/characters/bear.png'),
  require('../../assets/images/characters/dino.png'),
  require('../../assets/images/characters/dog.png'),
  require('../../assets/images/characters/koala.png'),
  require('../../assets/images/characters/cat.png'),
];

export default function TravelListScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  const [user, setUser] = useState<{ name: string; avatar: string; character?: string } | null>(null);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tripBalances, setTripBalances] = useState<{ [tripId: string]: { receivable: number; payable: number } }>({});

  useEffect(() => {
    if (user) {
      navigation.setOptions({
        headerTitle: () => (
          <View style={styles.customHeaderTitleContainer}>
            <Image 
              source={user.character ? characterImages[characterKeys.indexOf(user.character)] : require('../../assets/images/default-avatar.png')} 
              style={styles.headerAvatar}
            />
            <Text style={styles.headerTitleText}>{user.name}님, 반갑습니다!</Text>
          </View>
        ),
        headerRight: () => (
          <TouchableOpacity onPress={() => router.push('/profile/settings')} style={styles.settingsButton}>
            <Ionicons name="settings-outline" size={24} color="#333" />
          </TouchableOpacity>
        ),
        headerStyle: {
          backgroundColor: 'white',
        },
        headerShadowVisible: false,
      });
    }
  }, [user, navigation]);

  useEffect(() => {
    console.log('TravelListScreen useEffect triggered');
    
    // Firebase 연결 테스트
    testFirebaseConnection();
    
    const currentUser = getCurrentUser();
    if (currentUser) {
      console.log('Already authenticated user found:', currentUser.uid);
      setUser({
        name: currentUser.displayName || '사용자',
        avatar: currentUser.displayName?.charAt(0) || '사',
        character: currentUser.photoURL || undefined
      });
      loadTrips(currentUser.uid);
    }
    
    const unsubscribe = onAuthStateChange((firebaseUser) => {
      console.log('Auth state changed:', firebaseUser ? firebaseUser.uid : 'No user');
      
      if (firebaseUser) {
        console.log('User authenticated:', {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          photoURL: firebaseUser.photoURL
        });
        
        setUser({
          name: firebaseUser.displayName || '사용자',
          avatar: firebaseUser.displayName?.charAt(0) || '사',
          character: firebaseUser.photoURL || undefined
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

  // 개별 지출에 대한 받을돈/줄돈 계산 (trip/[id]와 동일한 로직)
  const calculateExpenseAmount = (expense: Expense, currentUserId: string) => {
    const splitAmount = expense.amount / expense.splitBetween.length;
    
    if (expense.paidBy === currentUserId) {
      // 내가 지불한 경우 - 다른 사람들이 나에게 줘야 할 돈 (받을돈)
      const othersAmount = expense.splitBetween.filter(userId => userId !== currentUserId).length * splitAmount;
      return {
        amount: othersAmount,
        type: 'receive' as 'receive'
      };
    } else if (expense.splitBetween.includes(currentUserId)) {
      // 다른 사람이 지불했고 내가 분할에 포함된 경우 - 내가 줘야 할 돈 (줄돈)
      return {
        amount: splitAmount,
        type: 'owe' as 'owe'
      };
    } else {
      // 내가 관련없는 지출
      return { amount: 0, type: 'owe' as 'owe' };
    }
  };

  // 여행별 정산 금액 계산
  const loadTripBalance = async (tripId: string) => {
    try {
      const currentUser = getCurrentUser();
      if (!currentUser) return;

      const expenses = await getTripExpenses(tripId);
      let totalReceivable = 0;  // 받을 돈
      let totalPayable = 0;     // 줄 돈

      expenses.forEach(expense => {
        const { amount, type } = calculateExpenseAmount(expense, currentUser.uid);
        if (type === 'receive') {
          totalReceivable += amount;
        } else if (type === 'owe') {
          totalPayable += amount;
        }
      });

      setTripBalances(prev => ({ 
        ...prev, 
        [tripId]: { 
          receivable: Math.round(totalReceivable), 
          payable: Math.round(totalPayable) 
        } 
      }));
    } catch (error) {
      console.error('Error loading trip balance:', error);
      setTripBalances(prev => ({ 
        ...prev, 
        [tripId]: { receivable: 0, payable: 0 } 
      }));
    }
  };

  const loadTrips = useCallback(async (userId: string) => {
    try {
      console.log('loadTrips called with userId:', userId);
      setLoading(true);
      
      const userTrips = await getUserTrips(userId);
      console.log('getUserTrips returned:', userTrips);
      
      setTrips(userTrips);
      console.log('Trips state updated, count:', userTrips.length);
      
      // 각 여행의 정산 금액 로드
      for (const trip of userTrips) {
        await loadTripBalance(trip.id);
      }
    } catch (error) {
      console.error('Error loading trips:', error);
      Alert.alert('오류', '여행 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
      setRefreshing(false);
      console.log('Loading completed');
    }
  }, []);

  const onRefresh = useCallback(() => {
    console.log('Refresh triggered');
    const currentUser = getCurrentUser();
    console.log('Current user for refresh:', currentUser ? currentUser.uid : 'No user');
    
    if (currentUser) {
      setRefreshing(true);
      loadTrips(currentUser.uid);
    }
  }, [loadTrips]);

  const handleAddTravel = () => {
    router.push('/trip/create');
  };

  const handleTravelPress = (travel: Trip) => {
    router.push(`/trip/${travel.id}`);
  };

  const renderTravelItem = (travel: Trip) => {
    const balance = tripBalances[travel.id] || { receivable: 0, payable: 0 };
    const netBalance = balance.receivable - balance.payable;
    const isPositive = netBalance >= 0;
    const formattedBalance = isPositive 
      ? `+KRW ${Math.abs(netBalance).toLocaleString()}`
      : `-KRW ${Math.abs(netBalance).toLocaleString()}`;
    
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
          <Text style={[
            styles.balanceAmount,
            { color: isPositive ? '#FF6B6B' : '#4A90E2' }
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
      <View style={[styles.loadingContainer, { paddingTop: insets.top }]}>
        <Text style={styles.loadingText}>로딩 중...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { paddingTop: Platform.OS === 'android' ? insets.top : 0 }]}
      contentContainerStyle={{ paddingBottom: insets.bottom }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {trips.length === 0 ? (
        renderEmptyState()
      ) : (
        <View style={styles.travelListContainer}>
          {trips.map(renderTravelItem)}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  customHeaderTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginRight: 10,
  },
  headerTitleText: {
    fontSize: 17,
    fontWeight: '600',
  },
  settingsButton: {
    marginRight: 15,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
  },
  loadingText: {
    fontSize: 16,
    color: '#495057',
  },
  travelListContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  travelItem: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 3,
  },
  travelInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  travelFlag: {
    fontSize: 28,
    marginRight: 16,
  },
  travelDetails: {
    flex: 1,
  },
  travelCountry: {
    fontSize: 17,
    fontWeight: '600',
    color: '#212529',
    marginBottom: 2,
  },
  travelDate: {
    fontSize: 13,
    color: '#868E96',
  },
  amountContainer: {
    paddingLeft: 10,
  },
  balanceAmount: {
    fontSize: 15,
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    minHeight: 400,
  },
  emptyIcon: {
    marginBottom: 24,
  },
  iconBackground: {
    backgroundColor: '#E3F2FD',
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#212529',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 15,
    color: '#495057',
    marginBottom: 24,
    textAlign: 'center',
    paddingHorizontal: 20,
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
    color: '#4A90E2',
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 8,
  },
}); 