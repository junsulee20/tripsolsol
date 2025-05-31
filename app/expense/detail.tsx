import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Modal,
  FlatList,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getTripMembers } from '../../services/firebaseService';

const CURRENCIES = [
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'KRW', symbol: '₩', name: 'Korean Won' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar' },
  { code: 'HKD', symbol: 'HK$', name: 'Hong Kong Dollar' },
];

const SPLIT_METHODS = [
  { id: 'equal', name: '균등 분할', description: '모든 멤버가 동일한 금액을 부담' },
  { id: 'percentage', name: '비율 분할', description: '설정한 비율에 따라 금액을 분할' },
  { id: 'custom', name: '직접 입력', description: '각 멤버별로 부담 금액을 직접 입력' },
];

interface Member {
  id: string;
  name: string;
  email: string;
  amount?: number;
  percentage?: number;
}

export default function ExpenseDetailScreen() {
  const { tripId, tripName, scannedAmount } = useLocalSearchParams();
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState(scannedAmount?.toString() || '');
  const [selectedCurrency, setSelectedCurrency] = useState(CURRENCIES[0]);
  const [showCurrencyModal, setShowCurrencyModal] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedPayer, setSelectedPayer] = useState('');
  const [splitMethod, setSplitMethod] = useState(SPLIT_METHODS[0]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMembers = async () => {
      try {
        const tripMembers = await getTripMembers(tripId as string);
        setMembers(tripMembers);
        if (tripMembers.length > 0) {
          setSelectedPayer(tripMembers[0].id);
        }
      } catch (error) {
        console.error('Error fetching members:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMembers();
  }, [tripId]);

  // Calculate split amounts whenever amount or split method changes
  useEffect(() => {
    if (!amount || members.length === 0) return;

    const totalAmount = parseFloat(amount);
    if (isNaN(totalAmount)) return;

    let updatedMembers = [...members];

    switch (splitMethod.id) {
      case 'equal':
        const equalAmount = totalAmount / members.length;
        updatedMembers = members.map(member => ({
          ...member,
          amount: equalAmount,
          percentage: (equalAmount / totalAmount) * 100
        }));
        break;

      case 'percentage':
        // If no percentages are set, distribute equally
        if (!members.some(m => m.percentage)) {
          const equalPercentage = 100 / members.length;
          updatedMembers = members.map(member => ({
            ...member,
            percentage: equalPercentage,
            amount: (totalAmount * equalPercentage) / 100
          }));
        } else {
          // Use existing percentages
          updatedMembers = members.map(member => ({
            ...member,
            amount: (totalAmount * (member.percentage || 0)) / 100
          }));
        }
        break;

      case 'custom':
        // Keep existing custom amounts
        break;
    }

    setMembers(updatedMembers);
  }, [amount, splitMethod.id]);

  const handlePercentageChange = (memberId: string, percentage: number) => {
    if (splitMethod.id !== 'percentage') return;

    const totalPercentage = members.reduce((sum, m) => 
      m.id === memberId ? sum + percentage : sum + (m.percentage || 0), 0);

    if (totalPercentage > 100) {
      Alert.alert('오류', '비율의 합이 100%를 초과할 수 없습니다.');
      return;
    }

    const totalAmount = parseFloat(amount) || 0;
    setMembers(members.map(member => ({
      ...member,
      percentage: member.id === memberId ? percentage : member.percentage,
      amount: member.id === memberId 
        ? (totalAmount * percentage) / 100 
        : member.amount
    })));
  };

  const handleCustomAmountChange = (memberId: string, customAmount: string) => {
    if (splitMethod.id !== 'custom') return;

    const amount = parseFloat(customAmount) || 0;
    setMembers(members.map(member => ({
      ...member,
      amount: member.id === memberId ? amount : member.amount
    })));
  };

  const handleSave = () => {
    if (!title.trim()) {
      Alert.alert('오류', '내용을 입력해주세요.');
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert('오류', '올바른 금액을 입력해주세요.');
      return;
    }

    // TODO: Save expense to Firebase
    router.back();
  };

  const renderCurrencyItem = ({ item }: { item: typeof CURRENCIES[0] }) => (
    <TouchableOpacity
      style={styles.currencyItem}
      onPress={() => {
        setSelectedCurrency(item);
        setShowCurrencyModal(false);
      }}
    >
      <Text style={styles.currencyCode}>{item.code}</Text>
      <Text style={styles.currencyName}>{item.name}</Text>
    </TouchableOpacity>
  );

  const renderMemberItem = ({ item }: { item: Member }) => (
    <TouchableOpacity
      style={[
        styles.memberItem,
        selectedPayer === item.id && styles.selectedMemberItem
      ]}
      onPress={() => setSelectedPayer(item.id)}
    >
      <View style={styles.memberInfo}>
        <View style={styles.memberAvatar}>
          <Text style={styles.memberAvatarText}>{item.name[0]}</Text>
        </View>
        <Text style={styles.memberName}>{item.name}</Text>
      </View>
      {selectedPayer === item.id && (
        <Ionicons name="checkmark-circle" size={24} color="#4A90E2" />
      )}
    </TouchableOpacity>
  );

  const renderSplitDetails = () => {
    if (!amount || members.length === 0) return null;

    return (
      <View style={styles.splitDetailsContainer}>
        <Text style={styles.splitDetailsTitle}>정산 내역</Text>
        {members.map((member) => (
          <View key={member.id} style={styles.splitDetailItem}>
            <View style={styles.memberInfo}>
              <View style={styles.memberAvatar}>
                <Text style={styles.memberAvatarText}>{member.name[0]}</Text>
              </View>
              <Text style={styles.memberName}>{member.name}</Text>
            </View>
            <View style={styles.splitAmountContainer}>
              {splitMethod.id === 'percentage' && (
                <TextInput
                  style={styles.percentageInput}
                  value={member.percentage?.toString()}
                  onChangeText={(text) => handlePercentageChange(member.id, parseFloat(text) || 0)}
                  keyboardType="numeric"
                  placeholder="0"
                />
              )}
              {splitMethod.id === 'custom' && (
                <TextInput
                  style={styles.amountInput}
                  value={member.amount?.toString()}
                  onChangeText={(text) => handleCustomAmountChange(member.id, text)}
                  keyboardType="numeric"
                  placeholder="0"
                />
              )}
              <Text style={styles.splitAmount}>
                {selectedCurrency.symbol}{member.amount?.toFixed(2)}
              </Text>
            </View>
          </View>
        ))}
      </View>
    );
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>지출 추가</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>내용</Text>
          <TextInput
            style={styles.input}
            placeholder="어떤 항목인지 입력해주세요"
            value={title}
            onChangeText={setTitle}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>화폐 / 금액</Text>
          <View style={styles.currencyAmountContainer}>
            <TouchableOpacity
              style={styles.currencySelector}
              onPress={() => setShowCurrencyModal(true)}
            >
              <Text style={styles.currencyText}>{selectedCurrency.code}</Text>
              <Ionicons name="chevron-down" size={20} color="#666" />
            </TouchableOpacity>
            <TextInput
              style={styles.amountInput}
              placeholder="0"
              keyboardType="numeric"
              value={amount}
              onChangeText={setAmount}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>결제자</Text>
          {loading ? (
            <Text>로딩 중...</Text>
          ) : members.length > 0 ? (
            <FlatList
              data={members}
              renderItem={renderMemberItem}
              keyExtractor={item => item.id}
              scrollEnabled={false}
            />
          ) : (
            <Text>멤버가 없습니다</Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>정산 방식</Text>
          {SPLIT_METHODS.map((method) => (
            <TouchableOpacity
              key={method.id}
              style={[
                styles.splitMethodItem,
                splitMethod.id === method.id && styles.selectedSplitMethod
              ]}
              onPress={() => setSplitMethod(method)}
            >
              <View style={styles.splitMethodInfo}>
                <Text style={styles.splitMethodName}>{method.name}</Text>
                <Text style={styles.splitMethodDescription}>{method.description}</Text>
              </View>
              {splitMethod.id === method.id && (
                <Ionicons name="checkmark-circle" size={24} color="#4A90E2" />
              )}
            </TouchableOpacity>
          ))}
        </View>

        {renderSplitDetails()}

        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          <Text style={styles.saveButtonText}>저장하기</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal
        visible={showCurrencyModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCurrencyModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>화폐 선택</Text>
              <TouchableOpacity
                onPress={() => setShowCurrencyModal(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={CURRENCIES}
              renderItem={renderCurrencyItem}
              keyExtractor={item => item.code}
            />
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
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
  backButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  placeholder: {
    width: 32,
  },
  content: {
    flex: 1,
  },
  section: {
    backgroundColor: 'white',
    padding: 20,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  currencyAmountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  currencySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    padding: 12,
    borderRadius: 8,
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  currencyText: {
    fontSize: 16,
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    marginBottom: 8,
  },
  selectedMemberItem: {
    backgroundColor: '#E3F2FD',
  },
  memberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#4A90E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  memberAvatarText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  memberName: {
    fontSize: 16,
    color: '#333',
  },
  splitMethodItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    marginBottom: 8,
  },
  selectedSplitMethod: {
    backgroundColor: '#E3F2FD',
  },
  splitMethodInfo: {
    flex: 1,
  },
  splitMethodName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  splitMethodDescription: {
    fontSize: 14,
    color: '#666',
  },
  saveButton: {
    backgroundColor: '#4A90E2',
    margin: 20,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  closeButton: {
    padding: 4,
  },
  currencyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  currencyCode: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    width: 60,
  },
  currencyName: {
    fontSize: 16,
    color: '#666',
  },
  splitDetailsContainer: {
    backgroundColor: 'white',
    padding: 20,
    marginBottom: 12,
  },
  splitDetailsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  splitDetailItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  splitAmountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  percentageInput: {
    width: 60,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 4,
    padding: 4,
    marginRight: 8,
    textAlign: 'right',
  },
  splitAmount: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
}); 