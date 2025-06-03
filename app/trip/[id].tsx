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
  ActivityIndicator,
  RefreshControl
} from 'react-native';
import TabLayout from '../../components/TabLayout';
import { 
  getTripById, 
  getUsersByIds, 
  getTripExpenses, 
  deleteExpense,
  calculateRealTripBalances 
} from '../../services/firebaseService';
import { Trip, User, Expense, Balance } from '../../types';

export default function TripDetailScreen() {
  const { id } = useLocalSearchParams();
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [participants, setParticipants] = useState<User[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const fetchTripData = async () => {
      if (!id || typeof id !== 'string') return;
      
      try {
        setLoading(true);
        await loadTripData(id);
      } catch (error) {
        console.error('Error fetching trip data:', error);
        Alert.alert('오류', '여행 정보를 불러오는데 실패했습니다.');
      } finally {
        setLoading(false);
      }
    };

    fetchTripData();
  }, [id]);

  const loadTripData = async (tripId: string) => {
    // Fetch trip data
    const tripData = await getTripById(tripId);
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
    const tripExpenses = await getTripExpenses(tripId);
    setExpenses(tripExpenses);
    
    // Calculate balances
    const tripBalances = await calculateRealTripBalances(tripId);
    setBalances(tripBalances);
  };

  const onRefresh = async () => {
    if (!id || typeof id !== 'string') return;
    
    setRefreshing(true);
    try {
      await loadTripData(id);
    } catch (error) {
      console.error('Error refreshing trip data:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleExpensePress = (expense: Expense) => {
    setSelectedExpense(expense);
    setModalVisible(true);
  };

  const handleEditExpense = () => {
    setModalVisible(false);
    if (selectedExpense) {
      router.push(`/expense/detail?tripId=${id}&expenseId=${selectedExpense.id}`);
    }
  };

  const handleDeleteExpense = () => {
    setModalVisible(false);
    if (!selectedExpense) return;
    
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
              Alert.alert('삭제됨', '지출이 삭제되었습니다.');
              // Refresh data
              if (id && typeof id === 'string') {
                await loadTripData(id);
              }
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

  const handleAddExpense = () => {
    router.push({
      pathname: '/expense/detail',
      params: { tripId: id, tripName: trip?.name }
    });
  };

  const getUserById = (userId: string): User | undefined => {
    return participants.find(user => user.id === userId);
  };

  const getExpenseIcon = (expense: Expense) => {
    switch (expense.category) {
      case 'food': return '🍔';
      case 'transport': return '🚗';
      case 'accommodation': return '🏨';
      case 'entertainment': return '🎉';
      case 'shopping': return '🛍️';
      default: return '💰';
    }
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      weekday: 'short'
    });
  };

  const groupExpensesByDate = () => {
    const grouped: { [key: string]: Expense[] } = {};
    
    expenses.forEach(expense => {
      const dateKey = formatDate(expense.date);
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(expense);
    });
    
    return Object.entries(grouped).map(([date, items]) => ({
      date,
      items
    }));
  };

  const getCurrentUserBalance = () => {
    // For now, we'll show the first balance or calculate based on current user
    // This should be updated to use the actual current user
    if (balances.length > 0) {
      const totalOwed = balances.reduce((sum, balance) => 
        balance.amount > 0 ? sum + balance.amount : sum, 0
      );
      const totalToReceive = balances.reduce((sum, balance) => 
        balance.amount < 0 ? sum + Math.abs(balance.amount) : sum, 0
      );
      
      return {
        receivable: totalToReceive,
        payable: totalOwed
      };
    }
    return { receivable: 0, payable: 0 };
  };

  const currentBalance = getCurrentUserBalance();

  const renderTripMateBox = () => (
    <View style={styles.tripMateBox}>
      <View style={styles.tripMateHeader}>
        <Text style={styles.tripMateTitle}>Trip mate</Text>
      </View>
      <View style={styles.tripMateMembers}>
        {participants.map((member, index) => (
          <View key={member.id} style={styles.tripMateItem}>
            <View style={[styles.tripMateAvatar, { backgroundColor: getAvatarColor(member.name) }]}>
              <Text style={styles.tripMateAvatarText}>{member.name.charAt(0)}</Text>
            </View>
            <Text style={styles.tripMateName}>{member.name}</Text>
          </View>
        ))}
        
        <TouchableOpacity style={styles.addMemberButton}>
          <Ionicons name="add" size={20} color="#666" />
        </TouchableOpacity>
      </View>
    </View>
  );

  const getAvatarColor = (name: string) => {
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFA726'];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  const renderExpenseItem = (item: Expense) => {
    const payer = getUserById(item.paidBy);
    
    return (
      <TouchableOpacity
        key={item.id}
        style={styles.expenseItem}
        onPress={() => handleExpensePress(item)}
      >
        <View style={styles.expenseInfo}>
          <View style={styles.expenseIcon}>
            <Text style={styles.expenseEmoji}>{getExpenseIcon(item)}</Text>
          </View>
          <View style={styles.expenseDetails}>
            <Text style={styles.expenseName}>{item.title}</Text>
            <Text style={styles.expensePaidBy}>{payer?.name || '알 수 없음'}</Text>
          </View>
        </View>
        <Text style={styles.expenseAmount}>{item.currency} {item.amount.toFixed(2)}</Text>
      </TouchableOpacity>
    );
  };

  const renderExpenseSection = (section: { date: string; items: Expense[] }) => (
    <View key={section.date} style={styles.expenseSection}>
      <Text style={styles.sectionDate}>{section.date}</Text>
      {section.items.map(renderExpenseItem)}
    </View>
  );

  if (loading) {
    return (
      <TabLayout>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <View style={styles.flagIcon}>
              <Text style={styles.flagText}>🌍</Text>
            </View>
            <View>
              <Text style={styles.tripTitle}>여행</Text>
              <Text style={styles.tripSubtitle}>정산을 시작하세요!</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.timerButton}>
            <Ionicons name="time" size={20} color="#4A90E2" />
          </TouchableOpacity>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4A90E2" />
          <Text style={styles.loadingText}>여행 정보 불러오는 중...</Text>
        </View>
      </TabLayout>
    );
  }

  const groupedExpenses = groupExpensesByDate();

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

      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#4A90E2']}
          />
        }
      >
        {renderTripMateBox()}
        
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>받을 돈: {trip?.currency || 'USD'} {currentBalance.receivable.toFixed(2)}</Text>
          <Text style={styles.summarySubtitle}>줄 돈: {trip?.currency || 'USD'} {currentBalance.payable.toFixed(2)}</Text>
          <TouchableOpacity 
            style={styles.settleButton}
            onPress={() => router.push(`/balance?tripId=${id}`)}
          >
            <Text style={styles.settleButtonText}>정산하기</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.addExpenseContainer}>
          <TouchableOpacity style={styles.addExpenseButton} onPress={handleAddExpense}>
            <Ionicons name="add" size={24} color="white" />
            <Text style={styles.addExpenseButtonText}>지출 추가</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.expensesContainer}>
          {groupedExpenses.length === 0 ? (
            <View style={styles.emptyExpenses}>
              <Ionicons name="receipt-outline" size={50} color="#ccc" />
              <Text style={styles.emptyExpensesText}>아직 등록된 지출이 없습니다</Text>
              <Text style={styles.emptyExpensesSubtext}>첫 번째 지출을 추가해보세요!</Text>
            </View>
          ) : (
            groupedExpenses.map(renderExpenseSection)
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
                  {formatDate(selectedExpense.date)}
                </Text>
                <View style={styles.modalExpenseInfo}>
                  <View style={styles.modalExpenseIcon}>
                    <Text style={styles.modalExpenseEmoji}>
                      {getExpenseIcon(selectedExpense)}
                    </Text>
                  </View>
                  <Text style={styles.modalExpenseName}>{selectedExpense.title}</Text>
                  <Text style={styles.modalExpenseAmount}>
                    {selectedExpense.currency} {selectedExpense.amount.toFixed(2)}
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
    color: '#666',
  },
  tripMateBox: {
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
  tripMateMembers: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tripMateItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 8,
  },
  tripMateAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  tripMateAvatarText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '600',
  },
  tripMateName: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  addMemberButton: {
    padding: 4,
    marginLeft: 8,
  },
  addExpenseContainer: {
    padding: 16,
    alignItems: 'center',
  },
  addExpenseButton: {
    flexDirection: 'row',
    backgroundColor: '#4A90E2',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    alignItems: 'center',
  },
  addExpenseButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
    marginLeft: 8,
  },
  emptyExpenses: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyExpensesText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
  },
  emptyExpensesSubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
  },
}); 