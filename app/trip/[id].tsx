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
import { getTripById, getUsersByIds, getTripExpenses, getCurrentUser, searchUserByName, updateTripParticipants } from '../../services/firebaseService';
import { Trip, User, Expense } from '../../types';

export default function TripDetailScreen() {
  const { id } = useLocalSearchParams();
  const [selectedExpense, setSelectedExpense] = useState<any>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [participants, setParticipants] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  
  // 멤버 관리 관련 상태
  const [memberModalVisible, setMemberModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isUpdatingMembers, setIsUpdatingMembers] = useState(false);

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
      } catch (error) {
        console.error('Error fetching trip data:', error);
        Alert.alert('오류', '여행 정보를 불러오는데 실패했습니다.');
      } finally {
        setLoading(false);
      }
    };

    fetchTripData();
  }, [id]);

  // 개별 지출에 대한 받을돈/줄돈 계산
  const calculateExpenseAmount = (expense: Expense) => {
    if (!currentUserId) return { amount: 0, type: 'owe' as 'owe' | 'receive' };
    
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

  const handleEditExpense = () => {
    setModalVisible(false);
    router.push(`/expense/detail?tripId=${id}&expenseId=${selectedExpense.id}`);
  };

  const handleDeleteExpense = () => {
    setModalVisible(false);
    Alert.alert(
      '삭제',
      '이 지출을 삭제하시겠습니까?',
      [
        { text: '취소', style: 'cancel' },
        { 
          text: '삭제', 
          style: 'destructive', 
          onPress: async () => {
            try {
              // TODO: Firebase에서 실제 삭제 구현
              // await deleteExpense(selectedExpense.id);
              
              // 임시로 로컬 상태에서 제거
              setExpenses(prev => prev.filter(exp => exp.id !== selectedExpense.id));
              Alert.alert('삭제됨', '지출이 삭제되었습니다.');
              setSelectedExpense(null);
            } catch (error) {
              Alert.alert('오류', '지출 삭제에 실패했습니다.');
            }
          }
        }
      ]
    );
  };

  const renderExpenseItem = (expense: Expense) => {
    const { amount, type } = calculateExpenseAmount(expense);
    const paidByUser = participants.find(p => p.id === expense.paidBy);
    
    return (
      <TouchableOpacity
        key={expense.id}
        style={styles.expenseItem}
        onPress={() => handleExpensePress(expense)}
      >
        <View style={styles.expenseInfo}>
          <View style={styles.expenseIcon}>
            <Text style={styles.expenseEmoji}>🍔</Text>
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
            {expense.currency} {amount.toFixed(0)}
          </Text>
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
          <View style={styles.tripMateList}>
            {participants.map((participant, index) => (
              <TouchableOpacity 
                key={participant.id} 
                style={styles.tripMateTag}
                onLongPress={() => handleRemoveMember(participant)}
                disabled={isUpdatingMembers}
              >
                <Text style={styles.tripMateTagText}>{participant.name}</Text>
                {participant.id === trip.createdBy && (
                  <Ionicons name="star" size={12} color="#1565C0" style={styles.creatorIcon} />
                )}
              </TouchableOpacity>
            ))}
            <TouchableOpacity 
              style={styles.addMemberButton} 
              onPress={() => setMemberModalVisible(true)}
              disabled={isUpdatingMembers}
            >
              <Ionicons name="add" size={16} color="#4A90E2" />
              <Text style={styles.addMemberText}>멤버 추가</Text>
            </TouchableOpacity>
          </View>
        </View>
        {isUpdatingMembers && (
          <View style={styles.updatingIndicator}>
            <ActivityIndicator size="small" color="#4A90E2" />
            <Text style={styles.updatingText}>업데이트 중...</Text>
          </View>
        )}
      </View>
    );
  };

  // 멤버 검색 함수
  const handleSearchUsers = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const results = await searchUserByName(query.trim());
      // 이미 참여 중인 멤버는 제외
      const filteredResults = results.filter(
        user => !participants.some(participant => participant.id === user.id)
      );
      setSearchResults(filteredResults);
    } catch (error) {
      console.error('Error searching users:', error);
      Alert.alert('오류', '사용자 검색에 실패했습니다.');
    } finally {
      setIsSearching(false);
    }
  };

  // 멤버 추가 함수
  const handleAddMember = async (newUser: User) => {
    if (!trip || !id || typeof id !== 'string') return;

    setIsUpdatingMembers(true);
    try {
      const updatedParticipants = [...trip.participants, newUser.id];
      
      // Firebase 업데이트
      await updateTripParticipants(id, updatedParticipants);
      
      // 로컬 상태 업데이트
      setTrip({ ...trip, participants: updatedParticipants });
      setParticipants([...participants, newUser]);
      
      Alert.alert('성공', `${newUser.name}님이 여행에 추가되었습니다.`);
      setMemberModalVisible(false);
      setSearchQuery('');
      setSearchResults([]);
    } catch (error) {
      console.error('Error adding member:', error);
      Alert.alert('오류', '멤버 추가에 실패했습니다.');
    } finally {
      setIsUpdatingMembers(false);
    }
  };

  // 멤버 삭제 함수
  const handleRemoveMember = (userToRemove: User) => {
    if (!trip || !id || typeof id !== 'string') return;
    
    // 여행 생성자는 삭제할 수 없음
    if (userToRemove.id === trip.createdBy) {
      Alert.alert('알림', '여행 생성자는 삭제할 수 없습니다.');
      return;
    }

    // 본인 삭제 확인
    if (userToRemove.id === currentUserId) {
      Alert.alert(
        '여행 나가기',
        '정말로 이 여행에서 나가시겠습니까?',
        [
          { text: '취소', style: 'cancel' },
          { 
            text: '나가기', 
            style: 'destructive',
            onPress: () => removeMemberFromTrip(userToRemove)
          }
        ]
      );
    } else {
      Alert.alert(
        '멤버 삭제',
        `${userToRemove.name}님을 여행에서 제외하시겠습니까?`,
        [
          { text: '취소', style: 'cancel' },
          { 
            text: '삭제', 
            style: 'destructive',
            onPress: () => removeMemberFromTrip(userToRemove)
          }
        ]
      );
    }
  };

  const removeMemberFromTrip = async (userToRemove: User) => {
    if (!trip || !id || typeof id !== 'string') return;

    setIsUpdatingMembers(true);
    try {
      const updatedParticipants = trip.participants.filter(
        participantId => participantId !== userToRemove.id
      );
      
      // Firebase 업데이트
      await updateTripParticipants(id, updatedParticipants);
      
      // 로컬 상태 업데이트
      setTrip({ ...trip, participants: updatedParticipants });
      setParticipants(participants.filter(p => p.id !== userToRemove.id));
      
      if (userToRemove.id === currentUserId) {
        // 본인이 나간 경우 여행 목록으로 이동
        Alert.alert('완료', '여행에서 나왔습니다.', [
          { text: '확인', onPress: () => router.back() }
        ]);
      } else {
        Alert.alert('완료', `${userToRemove.name}님이 여행에서 제외되었습니다.`);
      }
    } catch (error) {
      console.error('Error removing member:', error);
      Alert.alert('오류', '멤버 삭제에 실패했습니다.');
    } finally {
      setIsUpdatingMembers(false);
    }
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
        <TouchableOpacity style={styles.timerButton}>
          <Ionicons name="time" size={20} color="#4A90E2" />
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
                    <Text style={styles.modalExpenseEmoji}>🍔</Text>
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
                    {selectedExpense.splitBetween.map((userId: string, index: number) => {
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
                    })}
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

      {/* 멤버 관리 모달 */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={memberModalVisible}
        onRequestClose={() => setMemberModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.memberModalContent}>
            <View style={styles.memberModalHeader}>
              <Text style={styles.memberModalTitle}>멤버 추가</Text>
              <TouchableOpacity onPress={() => {
                setMemberModalVisible(false);
                setSearchQuery('');
                setSearchResults([]);
              }}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.searchContainer}>
              <TextInput
                style={styles.searchInput}
                value={searchQuery}
                onChangeText={(text) => {
                  setSearchQuery(text);
                  handleSearchUsers(text);
                }}
                placeholder="사용자 이름으로 검색"
                placeholderTextColor="#999"
              />
              {isSearching && (
                <ActivityIndicator size="small" color="#4A90E2" style={styles.searchLoader} />
              )}
            </View>

            <ScrollView style={styles.searchResults}>
              {searchResults.length > 0 ? (
                searchResults.map((user) => (
                  <TouchableOpacity
                    key={user.id}
                    style={styles.searchResultItem}
                    onPress={() => handleAddMember(user)}
                    disabled={isUpdatingMembers}
                  >
                    <View style={styles.searchResultInfo}>
                      <Text style={styles.searchResultName}>{user.name}</Text>
                      <Text style={styles.searchResultEmail}>{user.email}</Text>
                    </View>
                    <Ionicons name="add-circle" size={24} color="#4A90E2" />
                  </TouchableOpacity>
                ))
              ) : searchQuery.length > 0 && !isSearching ? (
                <Text style={styles.noResultsText}>검색 결과가 없습니다.</Text>
              ) : null}
            </ScrollView>
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
    paddingTop: 60,
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
  },
  tripTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  tripSubtitle: {
    fontSize: 14,
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
    color: '#1976D2',
    marginBottom: 4,
  },
  summarySubtitle: {
    fontSize: 14,
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
  },
  expenseDetails: {
    flex: 1,
  },
  expenseName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  expensePaidBy: {
    fontSize: 12,
    color: '#666',
  },
  expenseAmountContainer: {
    alignItems: 'flex-end',
  },
  expenseAmountLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 2,
  },
  expenseAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF6B6B',
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
  },
  modalExpenseName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  modalExpenseAmount: {
    fontSize: 18,
    fontWeight: '600',
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
  },
  memberName: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  editMemberButton: {
    padding: 4,
    marginRight: 8,
  },
  memberAmount: {
    fontSize: 14,
    color: '#666',
    marginRight: 8,
  },
  memberAmountValue: {
    fontSize: 14,
    fontWeight: '600',
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
    color: '#1976D2',
    marginBottom: 8,
  },
  memoText: {
    fontSize: 14,
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
    color: '#1976D2',
    marginRight: 12,
  },
  tripMateList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tripMateTag: {
    backgroundColor: '#90CAF9',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#64B5F6',
  },
  tripMateTagText: {
    fontSize: 14,
    color: '#1565C0',
    fontWeight: '600',
  },
  creatorIcon: {
    marginLeft: 8,
  },
  addMemberButton: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#64B5F6',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addMemberText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1565C0',
  },
  updatingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },
  updatingText: {
    fontSize: 14,
    color: '#4A90E2',
    marginLeft: 8,
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
    color: '#333',
    marginBottom: 16,
  },
  emptyExpensesSubtitle: {
    fontSize: 14,
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
    color: 'white',
  },
  memberModalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    maxHeight: '80%',
  },
  memberModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  memberModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  searchContainer: {
    padding: 20,
  },
  searchInput: {
    backgroundColor: '#E3F2FD',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  searchLoader: {
    marginLeft: 12,
  },
  searchResults: {
    flex: 1,
  },
  searchResultItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  searchResultInfo: {
    flex: 1,
  },
  searchResultName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  searchResultEmail: {
    fontSize: 14,
    color: '#666',
  },
  noResultsText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 20,
  },
}); 
 
