import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator
} from 'react-native';
import TabLayout from '../../components/TabLayout';
import { getTripById, getUsersByIds, getTripExpenses, getCurrentUser, deleteExpense } from '../../services/firebaseService';
import { convertToKRW } from '../../services/exchangeService';
import { Trip, User, Expense, ExpenseSplit, ExpenseCategory } from '../../types';
import { fonts } from '../../styles/globalStyles';

// 지출 카테고리별 이모지 매핑
const categoryEmojiMap: { [key in ExpenseCategory]: string } = {
  [ExpenseCategory.FOOD]: '🍽️',
  [ExpenseCategory.TRANSPORT]: '🚗',
  [ExpenseCategory.ACCOMMODATION]: '🏨',
  [ExpenseCategory.ENTERTAINMENT]: '🎡',
  [ExpenseCategory.SHOPPING]: '🛍️',
  [ExpenseCategory.OTHER]: '📝',
};

const getCategoryEmoji = (category?: ExpenseCategory): string => {
  if (!category) return categoryEmojiMap[ExpenseCategory.OTHER];
  return categoryEmojiMap[category] || categoryEmojiMap[ExpenseCategory.OTHER];
};

export default function TripDetailScreen() {
  const { id } = useLocalSearchParams();
  const [selectedExpense, setSelectedExpense] = useState<any>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [participants, setParticipants] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  // 환율 변환된 지출 데이터
  const [convertedExpenses, setConvertedExpenses] = useState<{ [expenseId: string]: number }>({});
  
  // Custom modal states
  const [customModalVisible, setCustomModalVisible] = useState(false);
  const [customModalMessage, setCustomModalMessage] = useState('');
  const [customModalType, setCustomModalType] = useState<'success' | 'error'>('success');
  
  // Delete confirmation states
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeletingExpense, setIsDeletingExpense] = useState(false);
  
  useEffect(() => {
    const fetchTripData = async () => {
      if (!id || typeof id !== 'string') return;
      
      try {
        setLoading(true);
        
        // Get current user
        const currentUser = getCurrentUser();
        if (!currentUser) {
          Alert.alert('오류', '로그인이 필요합니다.');
          router.back();
          return;
        }
        setCurrentUserId(currentUser.uid);
        console.log('Current user ID:', currentUser.uid);
        
        // Fetch trip data
        const tripData = await getTripById(id);
        if (!tripData) {
          Alert.alert('오류', '여행 정보를 찾을 수 없습니다.');
          router.back();
          return;
        }
        
        setTrip(tripData);
        console.log('Trip data:', tripData);
        
        // Fetch participants data
        const participantUsers = await getUsersByIds(tripData.participants);
        setParticipants(participantUsers);
        console.log('Participants:', participantUsers);
        
        // Fetch expenses data
        const expensesData = await getTripExpenses(id);
        console.log('Fetched expenses for tripId:', id);
        console.log('Expenses data:', expensesData);
        setExpenses(expensesData);
        
        // 환율 변환 수행
        await convertExpensesToKRW(expensesData);
      } catch (error) {
        console.error('Error fetching trip data:', error);
        Alert.alert('오류', '여행 정보를 불러오는데 실패했습니다.');
      } finally {
        setLoading(false);
      }
    };

    fetchTripData();
  }, [id]);

  // 지출을 KRW로 변환
  const convertExpensesToKRW = async (expensesData: Expense[]) => {
    const converted: { [expenseId: string]: number } = {};
    
    for (const expense of expensesData) {
      if (expense.currency && expense.currency !== 'KRW' && expense.currency !== 'KWR') {
        try {
          const convertedAmount = await convertToKRW(expense.amount, expense.currency);
          converted[expense.id] = convertedAmount;
          console.log(`Converted ${expense.amount} ${expense.currency} to ${convertedAmount} KRW`);
        } catch (error) {
          console.error(`Error converting ${expense.currency} to KRW:`, error);
          converted[expense.id] = expense.amount; // 실패 시 원래 금액 사용
        }
      } else {
        converted[expense.id] = expense.amount; // 이미 KRW인 경우
      }
    }
    
    setConvertedExpenses(converted);
  };

  // 개별 지출에 대한 받을돈/줄돈 계산 (환율 적용)
  const calculateExpenseAmount = (expense: Expense) => {
    if (!currentUserId) return { amount: 0, type: 'owe' as 'owe' | 'receive' };
    
    // 환율 변환된 금액 사용
    const convertedAmount = convertedExpenses[expense.id] || expense.amount;
    
    // splitDetails가 있는 경우 더 정확한 계산 사용
    if (expense.splitDetails && expense.splitDetails.length > 0) {
      if (expense.paidBy === currentUserId) {
        // 내가 지불한 경우 - 다른 사람들이 나에게 줘야 할 돈 (받을돈)
        const othersAmount = expense.splitDetails
          .filter(split => split.userId !== currentUserId)
          .reduce((total, split) => {
            // 각 분할도 환율 적용
            const convertedSplitAmount = (split.amount / expense.amount) * convertedAmount;
            return total + convertedSplitAmount;
          }, 0);
        return {
          amount: othersAmount,
          type: 'receive' as 'receive'
        };
      } else {
        // 다른 사람이 지불했고 내가 분할에 포함된 경우 - 내가 줘야 할 돈 (줄돈)
        const myShare = expense.splitDetails.find(split => split.userId === currentUserId);
        if (myShare) {
          const convertedSplitAmount = (myShare.amount / expense.amount) * convertedAmount;
          return {
            amount: convertedSplitAmount,
            type: 'owe' as 'owe'
          };
        }
      }
    } else {
      // 기존 방식 (균등 분할)
      const splitAmount = convertedAmount / expense.splitBetween.length;
      
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
      }
    }
    
    // 내가 관련없는 지출
    return { amount: 0, type: 'owe' as 'owe' };
  };

  // 지출 내역을 날짜별로 그룹화
  const groupExpensesByDate = () => {
    console.log('Grouping expenses:', expenses.length);
    
    if (expenses.length === 0) {
      console.log('No expenses to group');
      return [];
    }
    
    const grouped: { [key: string]: Expense[] } = {};
    
    expenses.forEach(expense => {
      console.log('Processing expense:', expense.title, expense.amount);
      
      const { amount } = calculateExpenseAmount(expense);
      console.log('Calculated amount for expense:', expense.title, amount);
      
      // amount가 0인 지출도 일단 표시해보자 (디버깅용)
      // if (amount === 0) return;
      
      const dateKey = expense.date.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        weekday: 'short'
      });
      
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(expense);
    });
    
    const result = Object.entries(grouped).map(([date, items]) => ({
      id: date,
      date,
      items
    }));
    
    console.log('Grouped expenses result:', result);
    return result;
  };

  // 전체 정산 금액 계산
  const calculateTotalBalances = () => {
    let totalReceivable = 0;  // 받을 돈
    let totalPayable = 0;     // 줄 돈

    expenses.forEach(expense => {
      const { amount, type } = calculateExpenseAmount(expense);
      if (type === 'receive') {
        totalReceivable += amount;
      } else if (type === 'owe') {
        totalPayable += amount;
      }
    });

    return {
      receivable: Math.round(totalReceivable),
      payable: Math.round(totalPayable)
    };
  };

  const balances = calculateTotalBalances();
  const groupedExpenses = groupExpensesByDate();

  const handleExpensePress = (expense: Expense) => {
    setSelectedExpense(expense);
    setModalVisible(true);
  };

  const showCustomModal = (message: string, type: 'success' | 'error') => {
    setCustomModalMessage(message);
    setCustomModalType(type);
    setCustomModalVisible(true);
    setTimeout(() => setCustomModalVisible(false), 2000);
  };

  const handleEditExpense = () => {
    setModalVisible(false);
    router.push({
      pathname: "/expense/edit" as any,
      params: { 
        tripId: id as string, 
        expenseId: selectedExpense.id 
      }
    });
  };

  const handleDeleteExpense = () => {
    setModalVisible(false);
    setShowDeleteConfirm(true);
  };

  const confirmDeleteExpense = async () => {
    setShowDeleteConfirm(false);
    setIsDeletingExpense(true);
    
    try {
      console.log('지출 삭제 시작...', selectedExpense.id);
      
      if (!selectedExpense || !selectedExpense.id) {
        throw new Error('삭제할 지출 정보를 찾을 수 없습니다.');
      }

      console.log('Firebase에서 지출 삭제 중...');
      // Firebase에서 실제 삭제 구현
      await deleteExpense(selectedExpense.id);
      console.log('Firebase 지출 삭제 완료');
      
      // 로컬 상태에서도 제거
      setExpenses(prev => prev.filter(exp => exp.id !== selectedExpense.id));
      
      showCustomModal('지출이 성공적으로 삭제되었습니다.', 'success');
      setSelectedExpense(null);
      
    } catch (error: any) {
      console.error('지출 삭제 오류:', error);
      console.error('오류 코드:', error.code);
      console.error('오류 메시지:', error.message);
      
      let errorMessage = '지출 삭제에 실패했습니다.';
      
      if (error.code === 'permission-denied') {
        errorMessage = '지출을 삭제할 권한이 없습니다.';
      } else if (error.code === 'not-found') {
        errorMessage = '삭제할 지출을 찾을 수 없습니다.';
      } else if (error.code === 'network-request-failed') {
        errorMessage = '네트워크 오류가 발생했습니다. 다시 시도해주세요.';
      }
      
      showCustomModal(errorMessage, 'error');
    } finally {
      setIsDeletingExpense(false);
    }
  };

  const renderExpenseItem = (expense: Expense) => {
    const { amount, type } = calculateExpenseAmount(expense);
    const paidByUser = participants.find(p => p.id === expense.paidBy);
    const convertedAmount = convertedExpenses[expense.id] || expense.amount;
    const isConvertedCurrency = expense.currency && expense.currency !== 'KRW' && expense.currency !== 'KWR';
    
    return (
      <TouchableOpacity
        key={expense.id}
        style={styles.expenseItem}
        onPress={() => handleExpensePress(expense)}
      >
        <View style={styles.expenseInfo}>
          <View style={styles.expenseIcon}>
            <Text style={styles.expenseEmoji}>{getCategoryEmoji(expense.category)}</Text>
          </View>
          <View style={styles.expenseDetails}>
            <Text style={styles.expenseName}>{expense.title}</Text>
            <Text style={styles.expensePaidBy}>{paidByUser?.name || '알 수 없음'}</Text>
          </View>
        </View>
        <View style={styles.expenseAmountContainer}>
          <Text style={[
            styles.expenseAmountLabel,
            { color: type === 'receive' ? '#FF6B6B' : '#4A90E2' }
          ]}>
            {type === 'receive' ? '받을돈' : '줄돈'}
          </Text>
          <Text style={[
            styles.expenseAmount,
            { color: type === 'receive' ? '#FF6B6B' : '#4A90E2' }
          ]}>
            KRW {Math.round(amount).toLocaleString()}
          </Text>
          {isConvertedCurrency && (
            <Text style={styles.originalCurrency}>
              ({expense.currency} {expense.amount.toLocaleString()})
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderExpenseSection = (section: any) => (
    <View key={section.id} style={styles.expenseSection}>
      <Text style={styles.sectionDate}>{section.date}</Text>
      {section.items.map(renderExpenseItem)}
    </View>
  );

  const renderTripMateBox = () => {
    if (!trip || participants.length === 0) return null;

    return (
      <View style={styles.tripMateCard}>
        <View style={styles.tripMateHeader}>
          <Text style={styles.tripMateTitle}>여행 멤버 :</Text>
          <View style={styles.tripMateContainer}>
            <View style={styles.tripMateList}>
              {participants.map((participant, index) => (
                <View key={participant.id} style={styles.tripMateTag}>
                  <Text style={styles.tripMateTagText}>{participant.name}</Text>
                  {participant.id === trip.createdBy && (
                    <Ionicons name="star" size={12} color="#1565C0" style={styles.creatorIcon} />
                  )}
                </View>
              ))}
            </View>
            <TouchableOpacity 
              style={styles.addMemberButton}
              onPress={() => router.push(`/trip/edit?id=${id}`)}
            >
              <Ionicons name="add" size={16} color="white" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <TabLayout>
        <View style={styles.loadingContainer}>
          <Text>로딩 중...</Text>
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
        <View style={styles.headerInfo}>
          <View style={styles.flagIcon}>
            <Text style={styles.flagText}>{trip?.emoji || '🌍'}</Text>
          </View>
          <View>
            <Text style={styles.tripTitle}>{trip?.name || '여행'}</Text>
            <Text style={styles.tripSubtitle}>정산을 시작하세요!</Text>
          </View>
        </View>
        <TouchableOpacity 
          style={styles.timerButton}
          onPress={() => router.push(`/trip/edit?id=${id}`)}
        >
          <Ionicons name="create-outline" size={20} color="#4A90E2" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {renderTripMateBox()}
        
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>받을 돈: KRW {balances.receivable}</Text>
          <Text style={styles.summarySubtitle}>줄 돈: KRW {balances.payable}</Text>
          <TouchableOpacity 
            style={styles.settleButton}
            onPress={() => router.push(`/balance?tripId=${id}`)}
          >
            <Text style={styles.settleButtonText}>정산하기</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.expensesContainer}>
          {groupedExpenses.length > 0 ? (
            groupedExpenses.map(renderExpenseSection)
          ) : (
            <View style={styles.emptyExpensesContainer}>
              <Text style={styles.emptyExpensesTitle}>아직 지출 내역이 없습니다</Text>
              <Text style={styles.emptyExpensesSubtitle}>새로운 지출을 추가해보세요!</Text>
              <TouchableOpacity 
                style={styles.addExpenseButton}
                onPress={() => router.push(`/expense/detail?tripId=${id}`)}
              >
                <Ionicons name="add" size={20} color="white" />
                <Text style={styles.addExpenseButtonText}>지출 추가</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>

      {/* 플로팅 액션 버튼 - 지출 추가 */}
      <TouchableOpacity 
        style={styles.floatingActionButton}
        onPress={() => router.push(`/expense/detail?tripId=${id}&tripName=${trip?.name || ''}`)}
      >
        <Ionicons name="add" size={24} color="white" />
      </TouchableOpacity>

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            
            {selectedExpense && (
              <View style={styles.modalBody}>
                <Text style={styles.modalDate}>{selectedExpense.date.toLocaleDateString('ko-KR', {
                  year: 'numeric',
                  month: '2-digit',
                  day: '2-digit',
                  weekday: 'short'
                })}</Text>
                <View style={styles.modalExpenseInfo}>
                  <View style={styles.modalExpenseIcon}>
                    <Text style={styles.modalExpenseEmoji}>{getCategoryEmoji(selectedExpense.category)}</Text>
                  </View>
                  <Text style={styles.modalExpenseName}>{selectedExpense.title}</Text>
                  <Text style={styles.modalExpenseAmount}>{selectedExpense.currency} {selectedExpense.amount}</Text>
                </View>

                <View style={styles.modalActions}>
                  <TouchableOpacity style={styles.editButton} onPress={handleEditExpense}>
                    <Ionicons name="create-outline" size={16} color="#4A90E2" />
                    <Text style={styles.editButtonText}>수정</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.deleteButton} onPress={handleDeleteExpense}>
                    <Ionicons name="trash-outline" size={16} color="#FF6B6B" />
                    <Text style={styles.deleteButtonText}>삭제</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.splitInfo}>
                  <Text style={styles.splitTitle}>결제 : {selectedExpense.currency} {selectedExpense.amount} ({participants.find(p => p.id === selectedExpense.paidBy)?.name || '알 수 없음'})</Text>
                  <View style={styles.splitMembers}>
                    {selectedExpense.splitDetails && selectedExpense.splitDetails.length > 0 ? (
                      // splitDetails가 있는 경우 정확한 정보 표시
                      selectedExpense.splitDetails.map((split: ExpenseSplit, index: number) => {
                        const participant = participants.find(p => p.id === split.userId);
                        
                        return (
                          <View key={split.userId} style={styles.splitMember}>
                            <View style={[styles.memberAvatar, { backgroundColor: ['#4ECDC4', '#96CEB4', '#FF6B6B', '#45B7D1'][index % 4] }]}>
                              <Text style={styles.memberAvatarText}>{participant?.name?.charAt(0) || '?'}</Text>
                            </View>
                            <Text style={styles.memberName}>{participant?.name || '알 수 없음'}</Text>
                            <TouchableOpacity style={styles.editMemberButton}>
                              <Ionicons name="create-outline" size={12} color="#4A90E2" />
                            </TouchableOpacity>
                            <Text style={styles.memberAmount}>{Math.round(split.percentage)}%</Text>
                            <Text style={styles.memberAmountValue}>{selectedExpense.currency} {split.amount.toFixed(0)}</Text>
                          </View>
                        );
                      })
                    ) : (
                      // 기존 방식 (균등 분할)
                      selectedExpense.splitBetween.map((userId: string, index: number) => {
                        const participant = participants.find(p => p.id === userId);
                        const splitAmount = selectedExpense.amount / selectedExpense.splitBetween.length;
                        const percentage = Math.round((splitAmount / selectedExpense.amount) * 100);
                        
                        return (
                          <View key={userId} style={styles.splitMember}>
                            <View style={[styles.memberAvatar, { backgroundColor: ['#4ECDC4', '#96CEB4', '#FF6B6B', '#45B7D1'][index % 4] }]}>
                              <Text style={styles.memberAvatarText}>{participant?.name?.charAt(0) || '?'}</Text>
                            </View>
                            <Text style={styles.memberName}>{participant?.name || '알 수 없음'}</Text>
                            <TouchableOpacity style={styles.editMemberButton}>
                              <Ionicons name="create-outline" size={12} color="#4A90E2" />
                            </TouchableOpacity>
                            <Text style={styles.memberAmount}>{percentage}%</Text>
                            <Text style={styles.memberAmountValue}>{selectedExpense.currency} {splitAmount.toFixed(0)}</Text>
                          </View>
                        );
                      })
                    )}
                  </View>
                </View>

                <View style={styles.memoSection}>
                  <Text style={styles.memoTitle}>메모</Text>
                  <Text style={styles.memoText}>{selectedExpense.description || '메모가 없습니다.'}</Text>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Custom Modal for Success/Error Messages */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={customModalVisible}
        onRequestClose={() => setCustomModalVisible(false)}
      >
        <View style={styles.customModalOverlay}>
          <View style={[
            styles.customModalContent,
            customModalType === 'success' ? styles.successModal : styles.errorModal
          ]}>
            <Ionicons 
              name={customModalType === 'success' ? 'checkmark-circle' : 'alert-circle'} 
              size={24} 
              color={customModalType === 'success' ? '#4CAF50' : '#FF6B6B'} 
            />
            <Text style={[
              styles.customModalText,
              { color: customModalType === 'success' ? '#4CAF50' : '#FF6B6B' }
            ]}>
              {customModalMessage}
            </Text>
          </View>
        </View>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={showDeleteConfirm}
        onRequestClose={() => setShowDeleteConfirm(false)}
      >
        <View style={styles.deleteModalOverlay}>
          <View style={styles.deleteModalContent}>
            <View style={styles.deleteModalHeader}>
              <Ionicons name="warning" size={32} color="#FF6B6B" />
              <Text style={styles.deleteModalTitle}>지출 삭제</Text>
            </View>
            
            <Text style={styles.deleteModalMessage}>
              이 지출을 삭제하시겠습니까?{'\n'}
              삭제된 지출은 복구할 수 없습니다.
            </Text>
            
            <View style={styles.deleteModalActions}>
              <TouchableOpacity 
                style={[styles.deleteModalButton, styles.cancelButton]}
                onPress={() => setShowDeleteConfirm(false)}
                disabled={isDeletingExpense}
              >
                <Text style={styles.cancelButtonText}>취소</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.deleteModalButton, styles.confirmDeleteButton]}
                onPress={confirmDeleteExpense}
                disabled={isDeletingExpense}
              >
                {isDeletingExpense ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={styles.confirmDeleteButtonText}>삭제</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </TabLayout>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 0,
    paddingBottom: 20,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  backButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginLeft: 16,
  },
  flagIcon: {
    marginRight: 12,
  },
  flagText: {
    fontSize: 24,
    fontFamily: fonts.regular,
  },
  tripTitle: {
    fontSize: 18,
    fontWeight: '600',
    fontFamily: fonts.semiBold,
    color: '#333',
  },
  tripSubtitle: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: '#666',
  },
  timerButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  summaryCard: {
    backgroundColor: '#E3F2FD',
    margin: 16,
    padding: 20,
    borderRadius: 12,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: fonts.semiBold,
    color: '#1976D2',
    marginBottom: 4,
  },
  summarySubtitle: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: '#1976D2',
    marginBottom: 16,
  },
  settleButton: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  settleButtonText: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: fonts.semiBold,
    color: '#1976D2',
  },
  expensesContainer: {
    padding: 16,
  },
  expenseSection: {
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionDate: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: fonts.semiBold,
    color: '#1976D2',
    marginBottom: 12,
  },
  expenseItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  expenseInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  expenseIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFF3E0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  expenseEmoji: {
    fontSize: 16,
    fontFamily: fonts.regular,
  },
  expenseDetails: {
    flex: 1,
  },
  expenseName: {
    fontSize: 14,
    fontWeight: '500',
    fontFamily: fonts.medium,
    color: '#333',
  },
  expensePaidBy: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: '#666',
  },
  expenseAmountContainer: {
    alignItems: 'flex-end',
  },
  expenseAmountLabel: {
    fontSize: 12,
    fontWeight: '500',
    fontFamily: fonts.medium,
    marginBottom: 2,
  },
  expenseAmount: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: fonts.semiBold,
    color: '#FF6B6B',
  },
  originalCurrency: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: '#666',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  modalBody: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  modalDate: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: fonts.semiBold,
    color: '#333',
    marginBottom: 16,
  },
  modalExpenseInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalExpenseIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFF3E0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  modalExpenseEmoji: {
    fontSize: 20,
    fontFamily: fonts.regular,
  },
  modalExpenseName: {
    fontSize: 18,
    fontWeight: '600',
    fontFamily: fonts.semiBold,
    color: '#333',
    flex: 1,
  },
  modalExpenseAmount: {
    fontSize: 18,
    fontWeight: '600',
    fontFamily: fonts.semiBold,
    color: '#4A90E2',
  },
  modalActions: {
    flexDirection: 'row',
    marginBottom: 24,
    gap: 12,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  editButtonText: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: '#4A90E2',
    marginLeft: 4,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFEBEE',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  deleteButtonText: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: '#FF6B6B',
    marginLeft: 4,
  },
  splitInfo: {
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  splitTitle: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: fonts.semiBold,
    color: '#1976D2',
    marginBottom: 12,
  },
  splitMembers: {
    gap: 8,
  },
  splitMember: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 8,
  },
  memberAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  memberAvatarText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '600',
    fontFamily: fonts.semiBold,
  },
  memberName: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: '#333',
    flex: 1,
  },
  editMemberButton: {
    padding: 4,
    marginRight: 8,
  },
  memberAmount: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: '#666',
    marginRight: 8,
  },
  memberAmountValue: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: fonts.semiBold,
    color: '#333',
  },
  memoSection: {
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    padding: 16,
  },
  memoTitle: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: fonts.semiBold,
    color: '#1976D2',
    marginBottom: 8,
  },
  memoText: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: '#1976D2',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tripMateCard: {
    backgroundColor: '#E3F2FD',
    margin: 16,
    marginBottom: 8,
    padding: 16,
    borderRadius: 12,
  },
  tripMateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  tripMateTitle: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: fonts.semiBold,
    color: '#1976D2',
    marginRight: 12,
  },
  tripMateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tripMateList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tripMateTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#90CAF9',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#64B5F6',
    marginRight: 8,
    marginBottom: 8,
  },
  tripMateTagText: {
    fontSize: 14,
    fontFamily: fonts.semiBold,
    color: '#1565C0',
    fontWeight: '600',
  },
  creatorIcon: {
    marginLeft: 4,
  },
  addMemberButton: {
    backgroundColor: '#4A90E2',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
    marginBottom: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  emptyExpensesContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyExpensesTitle: {
    fontSize: 18,
    fontWeight: '600',
    fontFamily: fonts.semiBold,
    color: '#333',
    marginBottom: 16,
  },
  emptyExpensesSubtitle: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: '#666',
    marginBottom: 20,
  },
  addExpenseButton: {
    backgroundColor: '#4A90E2',
    padding: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addExpenseButtonText: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: fonts.semiBold,
    color: 'white',
  },
  floatingActionButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#4A90E2',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    zIndex: 1000,
  },
  customModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  customModalContent: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    marginHorizontal: 40,
    minWidth: 200,
  },
  customModalText: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: fonts.semiBold,
    color: '#333',
    marginTop: 12,
  },
  successModal: {
    backgroundColor: '#E3F2FD',
  },
  errorModal: {
    backgroundColor: '#FFEBEE',
  },
  deleteModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteModalContent: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginHorizontal: 40,
    minWidth: 280,
  },
  deleteModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  deleteModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    fontFamily: fonts.semiBold,
    color: '#FF6B6B',
    marginLeft: 8,
  },
  deleteModalMessage: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: '#333',
    textAlign: 'center',
    marginBottom: 20,
  },
  deleteModalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  deleteModalButton: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#FFEBEE',
  },
  cancelButton: {
    backgroundColor: '#E3F2FD',
  },
  confirmDeleteButton: {
    backgroundColor: '#FF6B6B',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: fonts.semiBold,
    color: '#FF6B6B',
  },
  confirmDeleteButtonText: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: fonts.semiBold,
    color: 'white',
  },
}); 
 
