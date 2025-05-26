import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const balanceData = [
  {
    id: '1',
    name: 'Junsu',
    amount: 75000,
    currency: '₩',
    type: 'owed', // you are owed
    avatar: 'J'
  },
  {
    id: '2',
    name: 'ВИКАЭМ',
    amount: 75000,
    currency: '₩',
    type: 'owed',
    avatar: 'В',
    bankInfo: '우리은행 1002-345-67890',
    hasPayButton: true
  },
  {
    id: '3',
    name: '김윤정',
    amount: 75000,
    currency: '₩',
    type: 'owed',
    avatar: '김'
  },
  {
    id: '4',
    name: 'ВИКАЭМ',
    amount: 25.00,
    currency: 'US$',
    type: 'owed',
    avatar: 'В'
  },
  {
    id: '5',
    name: '김윤정',
    amount: 25.00,
    currency: 'US$',
    type: 'owed',
    avatar: '김'
  },
  {
    id: '6',
    name: 'Junsu',
    amount: 17.50,
    currency: 'US$',
    type: 'owed',
    avatar: 'J'
  }
];

export default function BalanceScreen() {
  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  const handleSelectItem = (id: string) => {
    if (selectedItems.includes(id)) {
      setSelectedItems(selectedItems.filter(item => item !== id));
    } else {
      setSelectedItems([...selectedItems, id]);
    }
  };

  const handlePay = (item: any) => {
    Alert.alert('결제', `${item.name}에게 ${item.currency}${item.amount.toLocaleString()}을 결제하시겠습니까?`);
  };

  const handleSettle = () => {
    if (selectedItems.length === 0) {
      Alert.alert('알림', '정산할 항목을 선택해주세요.');
      return;
    }
    Alert.alert('정산', `선택된 ${selectedItems.length}개 항목을 정산하시겠습니까?`);
  };

  const getAvatarColor = (name: string) => {
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD'];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  const renderBalanceItem = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={[
        styles.balanceItem,
        selectedItems.includes(item.id) && styles.balanceItemSelected
      ]}
      onPress={() => handleSelectItem(item.id)}
    >
      <View style={styles.itemContent}>
        <View style={[styles.avatar, { backgroundColor: getAvatarColor(item.name) }]}>
          <Text style={styles.avatarText}>{item.avatar}</Text>
        </View>
        
        <View style={styles.itemInfo}>
          <Text style={styles.itemName}>{item.name}</Text>
          {item.bankInfo && (
            <Text style={styles.bankInfo}>{item.bankInfo}</Text>
          )}
        </View>

        <View style={styles.itemRight}>
          <View style={styles.amountContainer}>
            <Text style={styles.owedLabel}>you are owed</Text>
            <Text style={styles.amountText}>
              {item.currency}{item.amount.toLocaleString()}
            </Text>
          </View>
          
          {item.hasPayButton && (
            <TouchableOpacity
              style={styles.payButton}
              onPress={() => handlePay(item)}
            >
              <Text style={styles.payButtonText}>결제</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
          <Ionicons name="close" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>정산할 금액을 선택해 주세요</Text>
        <View style={styles.placeholder} />
      </View>

      <FlatList
        data={balanceData}
        renderItem={renderBalanceItem}
        keyExtractor={(item) => item.id}
        style={styles.list}
        showsVerticalScrollIndicator={false}
      />

      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.settleButton,
            selectedItems.length === 0 && styles.settleButtonDisabled
          ]}
          onPress={handleSettle}
          disabled={selectedItems.length === 0}
        >
          <Text style={styles.settleButtonText}>선택하기</Text>
        </TouchableOpacity>
      </View>
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
  list: {
    flex: 1,
    paddingHorizontal: 16,
  },
  balanceItem: {
    backgroundColor: 'white',
    marginVertical: 4,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  balanceItemSelected: {
    borderWidth: 2,
    borderColor: '#4A90E2',
  },
  itemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  bankInfo: {
    fontSize: 12,
    color: '#666',
  },
  itemRight: {
    alignItems: 'flex-end',
  },
  amountContainer: {
    alignItems: 'flex-end',
    marginBottom: 8,
  },
  owedLabel: {
    fontSize: 12,
    color: '#4A90E2',
    marginBottom: 2,
  },
  amountText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4A90E2',
  },
  payButton: {
    backgroundColor: '#4A90E2',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
  },
  payButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  footer: {
    padding: 20,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
  },
  settleButton: {
    backgroundColor: '#4A90E2',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  settleButtonDisabled: {
    backgroundColor: '#BDC3C7',
  },
  settleButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
}); 