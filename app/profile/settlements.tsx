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
  RefreshControl,
  Platform
} from 'react-native';
import { getCurrentUser, getUserTrips, getTripExpenses, getUsersByIds } from '../../services/firebaseService';
import { Trip, Expense, User } from '../../types';
import TabLayout from '../../components/TabLayout';
import { fonts } from '../../styles/globalStyles';
import { convertToKRW } from '../../services/exchangeService';

type TripSettlement = {
  trip: Trip;
  myPayments: { toUserName: string; amount: number; currency: string }[];
  myReceivables: { fromUserName: string; amount: number; currency: string }[];
  totalToPay: number;
  totalToReceive: number;
};

export default function SettlementsScreen() {
  const [settlements, setSettlements] = useState<TripSettlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    const fetchSettlements = async () => {
      const user = getCurrentUser();
      if (!user) {
        router.replace('/auth/login');
        return;
      }
      
      setCurrentUserId(user.uid);
      setLoading(true);
      
      try {
        // 사용자의 모든 여행 가져오기
        const trips = await getUserTrips(user.uid);
        console.log('Found trips:', trips.length);
        
        const settlementPromises = trips.map(async (trip) => {
          try {
            // 각 여행의 지출 내역 가져오기
            const expenses = await getTripExpenses(trip.id);
            console.log(`Expenses for trip ${trip.name}:`, expenses.length);
            
            if (expenses.length === 0) {
              return {
                trip,
                myPayments: [],
                myReceivables: [],
                totalToPay: 0,
                totalToReceive: 0
              };
            }

            // 참가자 정보 가져오기
            const participants = await getUsersByIds(trip.participants);
            const participantMap = new Map(participants.map(p => [p.id, p]));

            // 정산 계산 (환율 적용)
            const allSettlements = await calculateAllSettlementsWithConversion(expenses, trip.participants);
            
            // 현재 사용자와 관련된 정산 필터링
            const myPayments = allSettlements
              .filter(settlement => settlement.fromUserId === user.uid)
              .map(settlement => ({
                toUserName: participantMap.get(settlement.toUserId)?.name || '알 수 없음',
                amount: settlement.amount,
                currency: 'KRW' // 환율 적용되어 모두 한화로 통일
              }));

            const myReceivables = allSettlements
              .filter(settlement => settlement.toUserId === user.uid)
              .map(settlement => ({
                fromUserName: participantMap.get(settlement.fromUserId)?.name || '알 수 없음',
                amount: settlement.amount,
                currency: 'KRW' // 환율 적용되어 모두 한화로 통일
              }));

            const totalToPay = myPayments.reduce((sum, payment) => sum + payment.amount, 0);
            const totalToReceive = myReceivables.reduce((sum, receivable) => sum + receivable.amount, 0);

            return {
              trip,
              myPayments,
              myReceivables,
              totalToPay,
              totalToReceive
            };
          } catch (error) {
            console.error(`Error processing trip ${trip.name}:`, error);
            return {
              trip,
              myPayments: [],
              myReceivables: [],
              totalToPay: 0,
              totalToReceive: 0
            };
          }
        });

        const settlementResults = await Promise.all(settlementPromises);
        // 정산이 있거나 지출이 있는 여행만 필터링
        const activeSettlements = settlementResults.filter(
          settlement => settlement.totalToPay > 0 || settlement.totalToReceive > 0
        );
        
        setSettlements(activeSettlements);
      } catch (error) {
        console.error('Error fetching settlements:', error);
        Alert.alert('오류', '정산 내역을 불러오는데 실패했습니다.');
      } finally {
        setLoading(false);
      }
    };

    fetchSettlements();
  }, []);

  // balance/index.tsx의 정산 계산 로직과 동일 (환율 적용)
  const calculateAllSettlementsWithConversion = async (expenses: Expense[], participants: string[]) => {
    // 각 지출을 KRW로 변환
    const convertedExpenses: { [expenseId: string]: number } = {};
    
    for (const expense of expenses) {
      if (expense.currency && expense.currency !== 'KRW' && expense.currency !== 'KWR') {
        try {
          const convertedAmount = await convertToKRW(expense.amount, expense.currency);
          convertedExpenses[expense.id] = convertedAmount;
          console.log(`Converted ${expense.amount} ${expense.currency} to ${convertedAmount} KRW`);
        } catch (error) {
          console.error(`Error converting ${expense.currency} to KRW:`, error);
          convertedExpenses[expense.id] = expense.amount; // 실패 시 원래 금액 사용
        }
      } else {
        convertedExpenses[expense.id] = expense.amount; // 이미 KRW인 경우
      }
    }

    const balances: { [userId: string]: number } = {};
    
    participants.forEach(userId => {
      balances[userId] = 0;
    });

    expenses.forEach(expense => {
      // 환율 변환된 금액 사용
      const convertedAmount = convertedExpenses[expense.id] || expense.amount;
      
      // splitDetails가 있는 경우 더 정확한 계산 사용
      if (expense.splitDetails && expense.splitDetails.length > 0) {
        // 결제자는 전체 금액을 받아야 함
        balances[expense.paidBy] += convertedAmount;
        
        // 각 사용자는 자신의 몫만큼 지불해야 함
        expense.splitDetails.forEach(split => {
          // 분할 금액도 환율 적용
          const convertedSplitAmount = (split.amount / expense.amount) * convertedAmount;
          balances[split.userId] -= convertedSplitAmount;
        });
      } else {
        // 기존 방식 (균등 분할)
        const splitAmount = convertedAmount / expense.splitBetween.length;
        balances[expense.paidBy] += convertedAmount;
        expense.splitBetween.forEach(userId => {
          balances[userId] -= splitAmount;
        });
      }
    });

    // 참가자가 2명인 경우 단순 정산
    if (participants.length === 2) {
      const settlements: { fromUserId: string; toUserId: string; amount: number }[] = [];
      
      const [user1, user2] = participants;
      const balance1 = balances[user1];
      const balance2 = balances[user2];
      
      // balance1이 양수면 user1이 받을 돈, 음수면 user1이 줄 돈
      if (Math.abs(balance1) > 1) { // 1원 이하는 무시
        if (balance1 > 0) {
          // user1이 user2로부터 받음
          settlements.push({
            fromUserId: user2,
            toUserId: user1,
            amount: Math.round(Math.abs(balance1))
          });
        } else {
          // user1이 user2에게 줌
          settlements.push({
            fromUserId: user1,
            toUserId: user2,
            amount: Math.round(Math.abs(balance1))
          });
        }
      }
      
      return settlements;
    }

    // 3명 이상인 경우 기존 복잡한 정산 알고리즘 사용
    const debtors = Object.entries(balances)
      .filter(([_, balance]) => balance < 0)
      .map(([userId, balance]) => ({ userId, amount: Math.abs(balance) }))
      .sort((a, b) => b.amount - a.amount);

    const creditors = Object.entries(balances)
      .filter(([_, balance]) => balance > 0)
      .map(([userId, balance]) => ({ userId, amount: balance }))
      .sort((a, b) => b.amount - a.amount);

    const settlements: { fromUserId: string; toUserId: string; amount: number }[] = [];
    const debtorsCopy = [...debtors];
    const creditorsCopy = [...creditors];

    while (debtorsCopy.length > 0 && creditorsCopy.length > 0) {
      const debtor = debtorsCopy[0];
      const creditor = creditorsCopy[0];
      const transferAmount = Math.min(debtor.amount, creditor.amount);
      
      if (transferAmount > 0) {
        settlements.push({
          fromUserId: debtor.userId,
          toUserId: creditor.userId,
          amount: Math.round(transferAmount)
        });

        debtor.amount -= transferAmount;
        creditor.amount -= transferAmount;

        if (debtor.amount <= 0) {
          debtorsCopy.shift();
        }
        if (creditor.amount <= 0) {
          creditorsCopy.shift();
        }
      }
    }

    return settlements;
  };

  const handleTripPress = (tripId: string) => {
    router.push(`/balance?tripId=${tripId}`);
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, Platform.OS === 'android' && styles.headerAndroid]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>정산 내역</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.loadingContainer}>
          <Text>로딩 중...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, Platform.OS === 'android' && styles.headerAndroid]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
          <Ionicons name="close" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>정산 내역</Text>
        <View style={styles.placeholder} />
      </View>
      
      <ScrollView style={styles.content}>
        {settlements.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="receipt-outline" size={64} color="#ccc" />
            <Text style={styles.emptyStateText}>정산할 내역이 없습니다</Text>
            <Text style={styles.emptyStateSubtext}>지출이 있는 여행의 정산 내역이 여기에 표시됩니다</Text>
          </View>
        ) : (
          <>
            <View style={styles.summary}>
              <Text style={styles.summaryTitle}>전체 정산 요약</Text>
              <View style={styles.summaryRow}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>내가 줄 총액</Text>
                  <Text style={[styles.summaryAmount, { color: '#e74c3c' }]}>
                    {settlements.reduce((sum, s) => sum + s.totalToPay, 0).toLocaleString()}원
                  </Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>내가 받을 총액</Text>
                  <Text style={[styles.summaryAmount, { color: '#27ae60' }]}>
                    {settlements.reduce((sum, s) => sum + s.totalToReceive, 0).toLocaleString()}원
                  </Text>
                </View>
              </View>
            </View>

            {settlements.map((settlement, index) => (
              <TouchableOpacity 
                key={settlement.trip.id} 
                style={styles.tripCard}
                onPress={() => handleTripPress(settlement.trip.id)}
                activeOpacity={0.7}
              >
                <View style={styles.tripHeader}>
                  <View style={styles.tripInfo}>
                    <Text style={styles.tripName}>{settlement.trip.name}</Text>
                    <Text style={styles.tripDate}>
                      {formatDate(settlement.trip.startDate)} - {formatDate(settlement.trip.endDate)}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#666" />
                </View>

                <View style={styles.settlementSummary}>
                  {settlement.totalToPay > 0 && (
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>💸 내가 줄 돈</Text>
                      <Text style={[styles.summaryAmount, { color: '#e74c3c' }]}>
                        {settlement.trip.currency} {settlement.totalToPay.toLocaleString()}
                      </Text>
                    </View>
                  )}
                  
                  {settlement.totalToReceive > 0 && (
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>💰 내가 받을 돈</Text>
                      <Text style={[styles.summaryAmount, { color: '#27ae60' }]}>
                        +{settlement.trip.currency} {settlement.totalToReceive.toLocaleString()}
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.detailsContainer}>
                  {settlement.myPayments.length > 0 && (
                    <View style={styles.detailSection}>
                      <Text style={styles.detailTitle}>줄 사람들:</Text>
                      {settlement.myPayments.map((payment, idx) => (
                        <Text key={idx} style={styles.detailItem}>
                          • {payment.toUserName}: {payment.currency} {payment.amount.toLocaleString()}
                        </Text>
                      ))}
                    </View>
                  )}
                  
                  {settlement.myReceivables.length > 0 && (
                    <View style={styles.detailSection}>
                      <Text style={styles.detailTitle}>받을 사람들:</Text>
                      {settlement.myReceivables.map((receivable, idx) => (
                        <Text key={idx} style={styles.detailItem}>
                          • {receivable.fromUserName}: {receivable.currency} {receivable.amount.toLocaleString()}
                        </Text>
                      ))}
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </>
        )}
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
    paddingTop: Platform.OS === 'ios' ? 10 : 0,
    paddingBottom: 20,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  headerAndroid: {
    paddingTop: 40, // 안드로이드 전용 상단 여백 추가
    marginTop: 0,
  },
  closeButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    flex: 1,
  },
  placeholder: {
    width: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  emptyState: {
    alignItems: 'center',
    marginTop: 100,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  summary: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  summaryAmount: {
    fontSize: 16,
    fontWeight: '600',
  },
  tripCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tripHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
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
  tripDate: {
    fontSize: 12,
    color: '#666',
  },
  settlementSummary: {
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    marginBottom: 12,
  },
  detailsContainer: {
    marginTop: 8,
  },
  detailSection: {
    marginBottom: 8,
  },
  detailTitle: {
    fontSize: 12,
    fontWeight: '500',
    color: '#666',
    marginBottom: 4,
  },
  detailItem: {
    fontSize: 12,
    color: '#333',
    marginLeft: 8,
    lineHeight: 16,
  },
}); 