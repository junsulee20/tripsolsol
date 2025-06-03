import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator
} from 'react-native';
import TabLayout from '../../components/TabLayout';
import { 
  getTripById, 
  getUsersByIds, 
  getTripExpenses,
  deleteExpense 
} from '../../services/firebaseService';
import { Trip, User, Expense } from '../../types';

interface ExpenseGroup {
  date: string;
  items: Expense[];
}

export default function TripDetailScreen() {
  const { id, refresh } = useLocalSearchParams();
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [participants, setParticipants] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [expenses, setExpenses] = useState<ExpenseGroup[]>([]);

  const fetchTripData = async () => {
    if (!id || typeof id !== 'string') return;
    
    try {
      setLoading(true);
      
      // Fetch trip data
      const tripData = await getTripById(id);
      if (!tripData) {
        Alert.alert('오류', '여행 정보를 찾을 수 없습니다.');
        router.back();
        return;
      }
      
      setTrip(tripData);
      
      // Fetch participants data
      const participantUsers = await getUsersByIds(tripData.participants);
      setParticipants(participantUsers);

      // Fetch expenses
      const expenseList = await getTripExpenses(id);
      
      // Group expenses by date
      const groupedExpenses = expenseList.reduce((groups: ExpenseGroup[], expense) => {
        const date = new Date(expense.date).toLocaleDateString('ko-KR', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          weekday: 'short'
        });

        const existingGroup = groups.find(g => g.date === date);
        if (existingGroup) {
          existingGroup.items.push(expense);
        } else {
          groups.push({ date, items: [expense] });
        }

        return groups;
      }, []);

      // Sort groups by date (newest first) and sort items within each group
      const sortedGroups = groupedExpenses
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .map(group => ({
          ...group,
          items: group.items.sort((a, b) => b.date.getTime() - a.date.getTime())
        }));

      setExpenses(sortedGroups);
    } catch (error) {
      console.error('Error fetching trip data:', error);
      Alert.alert('오류', '여행 정보를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTripData();
  }, [id, refresh]); // refresh 파라미터가 변경될 때도 데이터 다시 불러오기

  // 정산 금액 계산
  const calculateBalances = () => {
    let totalReceivable = 0;  // 받을 돈
    let totalPayable = 0;     // 줄 돈
    const currentUserId = 'current_user_id'; // TODO: 실제 현재 사용자 ID로 대체

    expenses.forEach(group => {
      group.items.forEach(expense => {
        const amount = expense.amount;
        if (expense.paidBy === currentUserId) {
          // 내가 지불한 금액
          totalReceivable += amount;
        } else {
          // 다른 사람이 지불한 금액 중 내가 부담해야 할 부분
          if (expense.splitBetween.includes(currentUserId)) {
            const myShare = amount / expense.splitBetween.length;
            totalPayable += myShare;
          }
        }
      });
    });

    return {
      receivable: totalReceivable,
      payable: Math.round(totalPayable)
    };
  };

  const balances = calculateBalances();

  const handleExpensePress = (expense: Expense) => {
    setSelectedExpense(expense);
    setModalVisible(true);
  };

  const handleEditExpense = () => {
    if (!selectedExpense) return;
    setModalVisible(false);
    router.push({
      pathname: "/expense/detail",
      params: { 
        tripId: id,
        expenseId: selectedExpense.id,
        edit: "true"
      }
    });
  };

  const handleDeleteExpense = () => {
    if (!selectedExpense) return;
    
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
              await deleteExpense(selectedExpense.id);
              fetchTripData(); // 데이터 다시 불러오기
              Alert.alert('삭제됨', '지출이 삭제되었습니다.');
              setSelectedExpense(null);
            } catch (error) {
              console.error('Error deleting expense:', error);
              Alert.alert('오류', '지출 삭제에 실패했습니다.');
            }
          }
        }
      ]
    );
  };

  const renderExpenseItem = (expense: Expense) => {
    const payer = participants.find(p => p.id === expense.paidBy);
    
    return (
      <TouchableOpacity
        key={expense.id}
        style={styles.expenseItem}
        onPress={() => handleExpensePress(expense)}
      >
        <View style={styles.expenseInfo}>
          <View style={styles.expenseIcon}>
            <Text style={styles.expenseEmoji}>💰</Text>
          </View>
          <View style={styles.expenseDetails}>
            <Text style={styles.expenseName}>{expense.title}</Text>
            <Text style={styles.expensePaidBy}>
              {payer ? payer.name : '알 수 없음'}
            </Text>
          </View>
        </View>
        <Text style={styles.expenseAmount}>
          {expense.currency} {expense.amount.toLocaleString()}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderExpenseSection = (section: ExpenseGroup) => (
    <View key={section.date} style={styles.expenseSection}>
      <Text style={styles.sectionDate}>{section.date}</Text>
      {section.items.map(renderExpenseItem)}
    </View>
  );

  if (loading) {
    return (
      <TabLayout>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4A90E2" />
          <Text style={styles.loadingText}>여행 정보를 불러오는 중...</Text>
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
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>받을 돈: {trip?.currency} {balances.receivable.toLocaleString()}</Text>
          <Text style={styles.summarySubtitle}>줄 돈: {trip?.currency} {balances.payable.toLocaleString()}</Text>
          <TouchableOpacity 
            style={styles.settleButton}
            onPress={() => router.push(`/balance?tripId=${id}`)}
          >
            <Text style={styles.settleButtonText}>정산하기</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.expensesContainer}>
          {expenses.length > 0 ? (
            expenses.map(renderExpenseSection)
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name="receipt-outline" size={64} color="#ccc" />
              <Text style={styles.emptyText}>아직 지출 내역이 없습니다</Text>
              <Text style={styles.emptySubtext}>새로운 지출을 추가해보세요!</Text>
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
                <Text style={styles.modalDate}>
                  {new Date(selectedExpense.date).toLocaleDateString('ko-KR', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    weekday: 'short'
                  })}
                </Text>
                <View style={styles.modalExpenseInfo}>
                  <View style={styles.modalExpenseIcon}>
                    <Text style={styles.modalExpenseEmoji}>💰</Text>
                  </View>
                  <Text style={styles.modalExpenseName}>{selectedExpense.title}</Text>
                  <Text style={styles.modalExpenseAmount}>
                    {selectedExpense.currency} {selectedExpense.amount.toLocaleString()}
                  </Text>
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
              </View>
            )}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
  }
}); 