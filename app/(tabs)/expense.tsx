import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import AddExpenseScreen from '../expense/add';

export default function ExpenseTabScreen() {
  return <AddExpenseScreen />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
}); 