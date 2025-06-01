import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import TabLayout from '../../components/TabLayout';

const mockExpenses = [
  {
    id: '1',
    date: '2025.06.19 (일)',
    items: [
      { id: '1', name: '인앤아웃', paidBy: 'Junsu', amount: 11, time: '11$' },
      { id: '2', name: '우버', paidBy: '나', amount: 30, time: '30$' },
      { id: '3', name: '맥주값', paidBy: '김윤정', amount: 26, time: '26$' },
    ]
  },
  {
    id: '2',
    date: '2025.06.18 (토)',
    items: [
      { id: '4', name: '호텔', paidBy: '나', amount: 100, time: '100$' },
      { id: '5', name: '카지노', paidBy: '나', amount: 100, time: '100$' },
    ]
  }
];

export default function TripDetailScreen() {
  const { id } = useLocalSearchParams();
  const [selectedExpense, setSelectedExpense] = useState<any>(null);
  const [modalVisible, setModalVisible] = useState(false);

  // 정산 금액 계산
  const calculateBalances = () => {
    let totalReceivable = 0;  // 받을 돈
    let totalPayable = 0;     // 줄 돈
    const myName = '나';      // 임시로 '나'를 현재 사용자로 설정

    mockExpenses.forEach(dateGroup => {
      dateGroup.items.forEach(expense => {
        const amount = expense.amount;
        if (expense.paidBy === myName || expense.paidBy === 'Junsu') {
          // 내가 지불한 금액
          totalReceivable += amount;
        } else {
          // 다른 사람이 지불한 금액 중 내가 부담해야 할 부분
          // 현재는 단순히 인원수로 나누어 계산
          const memberCount = 4; // 임시로 4명으로 설정
          totalPayable += amount / memberCount;
        }
      });
    });

    return {
      receivable: totalReceivable,
      payable: Math.round(totalPayable)
    };
  };

  const balances = calculateBalances();

  const handleExpensePress = (expense: any) => {
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
        { text: '삭제', style: 'destructive', onPress: () => {
          Alert.alert('삭제됨', '지출이 삭제되었습니다.');
        }}
      ]
    );
  };

  const renderExpenseItem = (item: any) => (
    <TouchableOpacity
      key={item.id}
      style={styles.expenseItem}
      onPress={() => handleExpensePress(item)}
    >
      <View style={styles.expenseInfo}>
        <View style={styles.expenseIcon}>
          <Text style={styles.expenseEmoji}>🍔</Text>
        </View>
        <View style={styles.expenseDetails}>
          <Text style={styles.expenseName}>{item.name}</Text>
          <Text style={styles.expensePaidBy}>{item.paidBy}</Text>
        </View>
      </View>
      <Text style={styles.expenseAmount}>{item.time}</Text>
    </TouchableOpacity>
  );

  const renderExpenseSection = (section: any) => (
    <View key={section.id} style={styles.expenseSection}>
      <Text style={styles.sectionDate}>{section.date}</Text>
      {section.items.map(renderExpenseItem)}
    </View>
  );

  return (
    <TabLayout>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <View style={styles.flagIcon}>
            <Text style={styles.flagText}>🇺🇸</Text>
          </View>
          <View>
            <Text style={styles.tripTitle}>미국여행</Text>
            <Text style={styles.tripSubtitle}>정산을 시작하세요!</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.timerButton}>
          <Ionicons name="time" size={20} color="#4A90E2" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>받을 돈: ${balances.receivable}</Text>
          <Text style={styles.summarySubtitle}>줄 돈: ${balances.payable}</Text>
          <TouchableOpacity 
            style={styles.settleButton}
            onPress={() => router.push(`/balance?tripId=${id}`)}
          >
            <Text style={styles.settleButtonText}>정산하기</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.expensesContainer}>
          {mockExpenses.map(renderExpenseSection)}
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
                <Text style={styles.modalDate}>2025.06.19 (일)</Text>
                <View style={styles.modalExpenseInfo}>
                  <View style={styles.modalExpenseIcon}>
                    <Text style={styles.modalExpenseEmoji}>🍔</Text>
                  </View>
                  <Text style={styles.modalExpenseName}>인앤아웃</Text>
                  <Text style={styles.modalExpenseAmount}>$11</Text>
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
                  <Text style={styles.splitTitle}>결제 : 44$ (Junsu)</Text>
                  <View style={styles.splitMembers}>
                    {['Junsu', 'ВИКАЭМ', '김윤정', '지한'].map((member, index) => (
                      <View key={member} style={styles.splitMember}>
                        <View style={[styles.memberAvatar, { backgroundColor: ['#4ECDC4', '#96CEB4', '#FF6B6B', '#45B7D1'][index] }]}>
                          <Text style={styles.memberAvatarText}>{member.charAt(0)}</Text>
                        </View>
                        <Text style={styles.memberName}>{member}</Text>
                        <TouchableOpacity style={styles.editMemberButton}>
                          <Ionicons name="create-outline" size={12} color="#4A90E2" />
                        </TouchableOpacity>
                        <Text style={styles.memberAmount}>25%</Text>
                        <Text style={styles.memberAmountValue}>$11</Text>
                      </View>
                    ))}
                  </View>
                </View>

                <View style={styles.memoSection}>
                  <Text style={styles.memoTitle}>메모</Text>
                  <Text style={styles.memoText}>할리우드 인앤아웃 존맛</Text>
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
}); 