import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

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

export default function ExpenseTabScreen() {
  const renderExpenseItem = (item: any) => (
    <TouchableOpacity
      key={item.id}
      style={styles.expenseItem}
      onPress={() => router.push(`/expense/detail/${item.id}`)}
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
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>지출 내역</Text>
        <TouchableOpacity 
          style={styles.addButton}
          onPress={() => router.push('/expense/add')}
        >
          <Ionicons name="add" size={24} color="#4A90E2" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.expensesContainer}>
          {mockExpenses.map(renderExpenseSection)}
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
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  addButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
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
}); 