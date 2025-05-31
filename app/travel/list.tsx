import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { getUserTrips } from '../../services/firebaseService';
import { Trip } from '../../types';

// 임시 데이터 - 실제로는 DB에서 가져와야 함
const mockExpenses = {
  'trip-1': [
    {
      id: '1',
      date: '2025.06.19',
      items: [
        { id: '1', name: '인앤아웃', paidBy: '나', amount: 11 },
        { id: '2', name: '우버', paidBy: '나', amount: 30 },
        { id: '3', name: '맥주값', paidBy: '김윤정', amount: 26 },
      ]
    },
    {
      id: '2',
      date: '2025.06.18',
      items: [
        { id: '4', name: '호텔', paidBy: '나', amount: 100 },
        { id: '5', name: '카지노', paidBy: '김윤정', amount: 100 },
      ]
    }
  ]
};

export default function TravelListScreen() {
  const [user] = useState({ name: '빅토리아', avatar: '빅' });
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);

  // 정산 금액 계산 함수
  const calculateTripBalance = (tripId: string) => {
    const expenses = mockExpenses[tripId] || [];
    let totalReceivable = 0;
    let totalPayable = 0;
    const myName = '나';
    const memberCount = 4; // 임시로 4명으로 설정

    expenses.forEach(dateGroup => {
      dateGroup.items.forEach(expense => {
        const amount = expense.amount;
        if (expense.paidBy === myName) {
          totalReceivable += amount;
        } else {
          totalPayable += amount / memberCount;
        }
      });
    });

    const netBalance = totalReceivable - Math.round(totalPayable);
    return {
      netBalance,
      formattedBalance: netBalance >= 0 ? `+$${netBalance}` : `-$${Math.abs(netBalance)}`
    };
  };

  useEffect(() => {
    const fetchTrips = async () => {
      try {
        const userId = 'test-user-id';
        const tripsFromDB = await getUserTrips(userId);
        console.log('Fetched trips:', tripsFromDB);
        setTrips(tripsFromDB);
      } catch (error) {
        console.error('Error fetching trips:', error);
        Alert.alert('오류', '여행 목록을 불러오지 못했습니다.');
      } finally {
        setLoading(false);
      }
    };
    fetchTrips();
  }, []);

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
              {travel.startDate?.toLocaleDateString?.() || ''}
              {travel.endDate ? ` ~ ${travel.endDate.toLocaleDateString?.()}` : ''}
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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.userInfo}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user.avatar}</Text>
          </View>
          <Text style={styles.userName}>{user.name}</Text>
          <Text style={styles.subtitle}>정산할 여행을 선택해주세요!</Text>
        </View>
        <TouchableOpacity style={styles.timerButton}>
          <Ionicons name="time" size={20} color="#4A90E2" />
        </TouchableOpacity>
      </View>

      <View style={styles.progressBar}>
        <View style={styles.progressFill} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>여행</Text>
          <View style={styles.travelsList}>
            {loading ? (
              <Text>로딩 중...</Text>
            ) : (
              trips.length > 0
                ? trips.map(renderTravelItem)
                : <Text>여행이 없습니다.</Text>
            )}
          </View>
          <TouchableOpacity style={styles.addTravelButton} onPress={handleAddTravel}>
            <Text style={styles.addTravelText}>새로운 여행 추가하기</Text>
          </TouchableOpacity>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: 'white',
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
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginRight: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
  },
  timerButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressBar: {
    height: 4,
    backgroundColor: '#E5E5E5',
  },
  progressFill: {
    height: '100%',
    width: '60%',
    backgroundColor: '#4A90E2',
  },
  content: {
    flex: 1,
  },
  section: {
    backgroundColor: '#E3F2FD',
    margin: 16,
    borderRadius: 12,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1976D2',
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
    borderRadius: 8,
    marginBottom: 8,
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
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  travelDate: {
    fontSize: 12,
    color: '#666',
  },
  travelAmount: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'right',
  },
  addTravelButton: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1976D2',
    borderStyle: 'dashed',
  },
  addTravelText: {
    fontSize: 16,
    color: '#1976D2',
    fontWeight: '500',
  },
  amountContainer: {
    alignItems: 'flex-end',
  },
  balanceAmount: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
}); 