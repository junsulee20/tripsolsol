import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Alert
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { getCurrentUser, getTripById, getTripExpenses, getUsersByIds } from '../../services/firebaseService';
import { Expense, Trip, User } from '../../types';

type BalanceItem = {
  fromUserId: string;
  toUserId: string;
  fromUserName: string;
  toUserName: string;
  toUserBankAccount?: string;
  amount: number;
  currency: string;
};

export default function BalanceScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [balanceItems, setBalanceItems] = useState<BalanceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    const fetchBalanceData = async () => {
      if (!tripId) return;
      
      setLoading(true);
      const user = getCurrentUser();
      if (!user) {
        router.replace('/auth/login');
        return;
      }
      
      setCurrentUserId(user.uid);
      
      try {
        // 여행 정보 가져오기
        const tripData = await getTripById(tripId);
        if (!tripData) {
          Alert.alert('오류', '여행 정보를 찾을 수 없습니다.');
          router.back();
          return;
        }
        setTrip(tripData);

        // 지출 내역 가져오기
        const expenses = await getTripExpenses(tripId);
        
        // 참가자 정보 가져오기
        const participants = await getUsersByIds(tripData.participants);
        const participantMap = new Map(participants.map(p => [p.id, p]));

        // 모든 정산 관계 계산
        const allSettlements = calculateAllSettlements(expenses, tripData.participants);
        
        // BalanceItem 형태로 변환
        const items: BalanceItem[] = allSettlements.map(settlement => ({
          fromUserId: settlement.fromUserId,
          toUserId: settlement.toUserId,
          fromUserName: participantMap.get(settlement.fromUserId)?.name || '알 수 없음',
          toUserName: participantMap.get(settlement.toUserId)?.name || '알 수 없음',
          toUserBankAccount: (participantMap.get(settlement.toUserId) as any)?.bankAccount,
          amount: settlement.amount,
          currency: tripData.currency
        }));

        setBalanceItems(items);
      } catch (error) {
        console.error('Error fetching balance data:', error);
        Alert.alert('오류', '정산 정보를 불러오는데 실패했습니다.');
      } finally {
        setLoading(false);
      }
    };

    fetchBalanceData();
  }, [tripId]);

  // 모든 사용자 간의 정산 관계를 계산하는 함수
  const calculateAllSettlements = (expenses: Expense[], participants: string[]) => {
    // 각 사용자별 순 잔액 계산
    const balances: { [userId: string]: number } = {};
    
    // 초기화
    participants.forEach(userId => {
      balances[userId] = 0;
    });

    // 각 지출에 대해 계산
    expenses.forEach(expense => {
      const splitAmount = expense.amount / expense.splitBetween.length;
      
      // 지불한 사람은 플러스 (받을 돈)
      balances[expense.paidBy] += expense.amount;
      
      // 분할 대상자들은 마이너스 (줄 돈)
      expense.splitBetween.forEach(userId => {
        balances[userId] -= splitAmount;
      });
    });

    // 정산이 필요한 사용자들 분리
    const debtors = Object.entries(balances)
      .filter(([_, balance]) => balance < 0)
      .map(([userId, balance]) => ({ userId, amount: Math.abs(balance) }))
      .sort((a, b) => b.amount - a.amount);

    const creditors = Object.entries(balances)
      .filter(([_, balance]) => balance > 0)
      .map(([userId, balance]) => ({ userId, amount: balance }))
      .sort((a, b) => b.amount - a.amount);

    // 정산 관계 계산
    const settlements: { fromUserId: string; toUserId: string; amount: number }[] = [];
    
    // 복사본을 만들어서 수정
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

        // 금액 차감
        debtor.amount -= transferAmount;
        creditor.amount -= transferAmount;

        // 완료된 항목 제거
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

  const copyBankAccount = async (bankAccount: string, userName: string) => {
    try {
      await Clipboard.setStringAsync(bankAccount);
      Alert.alert('복사 완료', `${userName}님의 계좌번호가 복사되었습니다.`);
    } catch (error) {
      Alert.alert('오류', '계좌번호 복사에 실패했습니다.');
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>정산하기</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.loadingContainer}>
          <Text>로딩 중...</Text>
        </View>
      </View>
    );
  }

  // 현재 사용자와 관련된 정산
  const myPayments = balanceItems.filter(item => item.fromUserId === currentUserId);
  const myReceivables = balanceItems.filter(item => item.toUserId === currentUserId);
  
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
          <Ionicons name="close" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{trip?.name} 정산</Text>
        <View style={styles.placeholder} />
      </View>
      
      <ScrollView style={styles.content}>
        {/* 내가 줄 돈 */}
        {myPayments.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>💸 내가 줄 돈</Text>
            {myPayments.map((item, index) => (
              <View key={index} style={[styles.balanceItem, styles.myBalanceItem]}>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName}>{item.toUserName}님에게</Text>
                  <Text style={styles.itemAmount}>
                    {item.currency} {item.amount.toLocaleString()}
                  </Text>
                </View>
                {item.toUserBankAccount && (
                  <TouchableOpacity 
                    style={styles.bankAccountButton}
                    onPress={() => copyBankAccount(item.toUserBankAccount!, item.toUserName)}
                  >
                    <Ionicons name="card" size={16} color="#4A90E2" />
                    <Text style={styles.bankAccountText}>{item.toUserBankAccount}</Text>
                    <Ionicons name="copy" size={14} color="#4A90E2" />
                  </TouchableOpacity>
                )}
                {!item.toUserBankAccount && (
                  <Text style={styles.noBankAccount}>계좌번호 미등록</Text>
                )}
              </View>
            ))}
          </View>
        )}

        {/* 내가 받을 돈 */}
        {myReceivables.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>💰 내가 받을 돈</Text>
            {myReceivables.map((item, index) => (
              <View key={index} style={[styles.balanceItem, styles.myBalanceItem]}>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName}>{item.fromUserName}님에게서</Text>
                  <Text style={[styles.itemAmount, { color: '#27ae60' }]}>
                    +{item.currency} {item.amount.toLocaleString()}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {balanceItems.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>정산할 내역이 없습니다.</Text>
            <Text style={styles.emptyStateSubtext}>모든 정산이 완료되었습니다! 🎉</Text>
          </View>
        )}

        {myPayments.length === 0 && myReceivables.length === 0 && balanceItems.length > 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>나와 관련된 정산이 없습니다.</Text>
            <Text style={styles.emptyStateSubtext}>모든 정산이 완료되었습니다! 🎉</Text>
          </View>
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
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
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
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  balanceItem: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  myBalanceItem: {
    borderLeftWidth: 4,
    borderLeftColor: '#4A90E2',
  },
  itemInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  itemAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#e74c3c',
  },
  bankAccountButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F8FF',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#4A90E2',
  },
  bankAccountText: {
    fontSize: 14,
    color: '#4A90E2',
    marginLeft: 8,
    marginRight: 8,
    flex: 1,
  },
  noBankAccount: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
  },
  emptyState: {
    alignItems: 'center',
    marginTop: 60,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#666',
  },
}); 