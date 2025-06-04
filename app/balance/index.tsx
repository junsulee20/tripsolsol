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

// 현재 사용자와 다른 모든 사용자 간의 정산 관계를 계산하는 함수
const calculateAllSettlements = (expenses: Expense[], participants: string[], currentUserIdParam: string) => {
  console.log('[정산계산] 시작 - 현재사용자:', currentUserIdParam, '참가자:', participants.length, '지출:', expenses.length);
  // 사용자 쌍별 잔액 계산 (A가 B에게 얼마나 빚지고 있는가)
  const pairwiseBalances: { [fromTo: string]: number } = {};
  
  // 모든 사용자 쌍에 대해 초기화
  participants.forEach(fromUser => {
    participants.forEach(toUser => {
      if (fromUser !== toUser) {
        pairwiseBalances[`${fromUser}-${toUser}`] = 0;
      }
    });
  });

  // 각 지출에 대해 계산
  expenses.forEach(expense => {
    if (expense.amount <= 0 || expense.splitBetween.length === 0) return; // 금액이 없거나 분배 대상이 없으면 스킵
    const splitAmount = expense.amount / expense.splitBetween.length;
    
    // 분할 대상자들이 지불한 사람에게 각자의 몫을 빚지게 됨
    expense.splitBetween.forEach(splitUserId => {
      if (splitUserId !== expense.paidBy) {
        const key = `${splitUserId}-${expense.paidBy}`;
        pairwiseBalances[key] = (pairwiseBalances[key] || 0) + splitAmount;
      }
    });
  });
  console.log('[정산계산] 최종 쌍별 잔액:', pairwiseBalances);

  // 현재 사용자와 관련된 정산만 추출
  const settlements: { fromUserId: string; toUserId: string; amount: number }[] = [];
  
  participants.forEach(otherUserId => {
    if (otherUserId === currentUserIdParam) return;
    
    // 현재 사용자가 다른 사용자에게 빚진 금액
    const iOweToOther = pairwiseBalances[`${currentUserIdParam}-${otherUserId}`] || 0;
    // 다른 사용자가 현재 사용자에게 빚진 금액  
    const otherOwesToMe = pairwiseBalances[`${otherUserId}-${currentUserIdParam}`] || 0;
    
    // 순 정산액 계산
    const netAmount = iOweToOther - otherOwesToMe;
    
    if (netAmount > 0.01) { // 내가 줘야 하는 경우
      settlements.push({
        fromUserId: currentUserIdParam,
        toUserId: otherUserId,
        amount: Math.round(netAmount)
      });
    } else if (netAmount < -0.01) { // 내가 받아야 하는 경우
      settlements.push({
        fromUserId: otherUserId,
        toUserId: currentUserIdParam,
        amount: Math.round(Math.abs(netAmount))
      });
    }
  });

  console.log('[정산계산] 최종 정산 결과:', settlements);
  return settlements;
};

export default function BalanceScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [balanceItems, setBalanceItems] = useState<BalanceItem[]>([]);
  const [loading, setLoading] = useState(true);
  // currentUserId 상태는 여전히 필요할 수 있으므로 유지합니다 (UI의 다른 부분 등).
  // 다만, calculateAllSettlements에는 파라미터로 명확히 전달합니다.
  const [, setCurrentUserIdInternal] = useState<string | null>(null);

  useEffect(() => {
    const fetchBalanceData = async () => {
      console.log('=== fetchBalanceData 시작 ===');
      console.log('받은 tripId:', tripId);
      
      if (!tripId) {
        console.error('tripId가 없음!');
        Alert.alert('오류', '여행 ID가 없어 정산 정보를 불러올 수 없습니다.');
        setLoading(false);
        return;
      }
      
      setLoading(true);
      const user = getCurrentUser();
      if (!user || !user.uid) {
        console.error('사용자 정보 없음 또는 UID 없음');
        Alert.alert('오류', '사용자 정보를 확인할 수 없어 정산을 진행할 수 없습니다.');
        router.replace('/auth/login');
        setLoading(false);
        return;
      }
      
      const localCurrentUserId = user.uid;
      console.log('현재 사용자 ID:', localCurrentUserId);
      setCurrentUserIdInternal(localCurrentUserId); // 내부 상태 업데이트
      
      try {
        // 여행 정보 가져오기
        console.log('여행 정보 가져오는 중...', tripId);
        const tripData = await getTripById(tripId);
        if (!tripData) {
          console.error('여행 정보를 찾을 수 없음');
          Alert.alert('오류', '여행 정보를 찾을 수 없습니다.');
          router.back();
          return;
        }
        console.log('가져온 여행 정보:', tripData);
        setTrip(tripData);

        // 지출 내역 가져오기
        console.log('지출 내역 가져오는 중...');
        const expenses = await getTripExpenses(tripId);
        console.log('가져온 지출 내역:', expenses);
        
        // 참가자 정보 가져오기 (여행 정보의 참가자 ID 목록 사용)
        if (!tripData.participants || tripData.participants.length === 0) {
          console.error('여행에 참가자 정보가 없습니다.');
          Alert.alert('오류', '여행에 참가자 정보가 없어 정산할 수 없습니다.');
          setLoading(false);
          return;
        }
        console.log('참가자 ID 목록으로 정보 가져오는 중...', tripData.participants);
        const participantsData = await getUsersByIds(tripData.participants);
        console.log('가져온 참가자 정보:', participantsData);
        const participantMap = new Map(participantsData.map(p => [p.id, p]));

        // 모든 정산 관계 계산 (localCurrentUserId를 명시적으로 전달)
        const allSettlements = calculateAllSettlements(expenses, tripData.participants, localCurrentUserId);
        
        console.log('=== 최종 계산된 정산 내역 (allSettlements):', allSettlements);
        
        // BalanceItem 형태로 변환
        const items: BalanceItem[] = allSettlements.map(settlement => ({
          fromUserId: settlement.fromUserId,
          toUserId: settlement.toUserId,
          fromUserName: participantMap.get(settlement.fromUserId)?.name || '알 수 없음',
          toUserName: participantMap.get(settlement.toUserId)?.name || '알 수 없음',
          toUserBankAccount: (participantMap.get(settlement.toUserId) as any)?.bankAccount, // User 타입에 bankAccount 추가 고려
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
  }, [tripId]); // tripId가 변경될 때마다 실행

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

  // 현재 사용자와 관련된 정산 (myPayments, myReceivables 계산은 이제 localCurrentUserId가 아닌, state로 관리되는 currentUserId를 사용해도 무방.
  // 하지만, 렌더링 시점에 필요한 currentUserId는 calculateAllSettlements에 이미 정확히 전달되었으므로, 이 부분은 그대로 두어도 됨)
  const currentUserIdForFilter = getCurrentUser()?.uid; // 안전하게 현재 사용자를 다시 가져와 필터링에 사용
  const myPayments = balanceItems.filter(item => item.fromUserId === currentUserIdForFilter);
  const myReceivables = balanceItems.filter(item => item.toUserId === currentUserIdForFilter);
  
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
              <View key={`${item.toUserId}-${index}`} style={[styles.balanceItem, styles.myBalanceItem]}>
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
              <View key={`${item.fromUserId}-${index}`} style={[styles.balanceItem, styles.myBalanceItem]}>
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

        {myPayments.length === 0 && myReceivables.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>
              {balanceItems.length === 0 ? '정산할 내역이 없습니다.' : '나와 관련된 정산 내역이 없습니다.'}
            </Text>
            <Text style={styles.emptyStateSubtext}>🎉</Text>
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
    paddingTop: 60, // SafeArea 고려
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
    width: 32, // 오른쪽 아이콘 공간 확보용 (없으면 중앙정렬 깨짐)
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
    borderLeftColor: '#4A90E2', // 나의 관련된 항목 강조
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
    color: '#e74c3c', // 줄 돈 기본 색상
  },
  bankAccountButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F8FF', // 연한 파란색 배경
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#4A90E2', // 파란색 테두리
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
    marginTop: 4,
  },
  emptyState: {
    alignItems: 'center',
    marginTop: 60,
    paddingHorizontal: 20,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#666',
  },
}); 