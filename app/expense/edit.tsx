import React, { useState, useEffect, useRef } from 'react';
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
  ActivityIndicator,
  Modal
} from 'react-native';
let RNDateTimePicker: any = null;
if (Platform.OS !== 'web') {
  try {
    RNDateTimePicker = require('@react-native-community/datetimepicker').default;
  } catch (error) {
    console.warn('DateTimePicker not available:', error);
  }
}
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import TabLayout from '../../components/TabLayout';
import { 
  updateExpense, 
  getTripById, 
  getUsersByIds, 
  getCurrentUser,
  getTripExpenses
} from '../../services/firebaseService';
import { Trip, User, Expense, ExpenseSplit } from '../../types';

const splitMethods = [
  { id: 'equal', name: '균일하게', description: '모든 사람이 동일한 금액' },
  { id: 'unequal', name: '비율대로', description: '각자 설정' },
  { id: 'custom', name: '직접 설정', description: '원하는 대로' },
];

const currencies = [
  { code: 'USD', name: '미국 달러', symbol: '$' },
  { code: 'EUR', name: '유로', symbol: '€' },
  { code: 'KRW', name: '한국 원', symbol: '₩' },
  { code: 'JPY', name: '일본 엔', symbol: '¥' },
  { code: 'GBP', name: '영국 파운드', symbol: '£' },
  { code: 'CNY', name: '중국 위안', symbol: '¥' },
  { code: 'AUD', name: '호주 달러', symbol: 'A$' },
  { code: 'CAD', name: '캐나다 달러', symbol: 'C$' },
  { code: 'CHF', name: '스위스 프랑', symbol: 'CHF' },
  { code: 'SGD', name: '싱가포르 달러', symbol: 'S$' },
  { code: 'THB', name: '태국 바트', symbol: '฿' },
  { code: 'VND', name: '베트남 동', symbol: '₫' },
];

interface MemberAmount {
  userId: string;
  name: string;
  amount: number;
  percentage: number;
}

// Helper function to format currency
const formatDisplayAmount = (amount: number | string, currencyCode: string): string => {
  const num = typeof amount === 'string' ? parseFloat(amount.replace(/,/g, '')) : amount;
  if (isNaN(num)) return '0';

  if (currencyCode === 'KRW') {
    return num.toLocaleString('ko-KR'); // KRW: no decimals, with commas
  } else {
    // Other currencies: 2 decimal places, with commas
    return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }); 
  }
};

// Helper function to parse a formatted amount string back to a number string (without commas)
const parseDisplayAmount = (formattedAmount: string): string => {
  return formattedAmount.replace(/,/g, '');
};

export default function ExpenseEditScreen() {
  const { tripId, expenseId } = useLocalSearchParams();
  const hiddenDateInputRef = useRef<HTMLInputElement>(null);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [originalExpense, setOriginalExpense] = useState<Expense | null>(null);
  const [members, setMembers] = useState<User[]>([]);
  const [memberAmounts, setMemberAmounts] = useState<MemberAmount[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currencyModalVisible, setCurrencyModalVisible] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Form states
  const [description, setDescription] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [displayTotalAmount, setDisplayTotalAmount] = useState('0');
  const [currency, setCurrency] = useState('USD');
  const [paidBy, setPaidBy] = useState('');
  const [splitMethod, setSplitMethod] = useState('equal');
  const [memo, setMemo] = useState('');
  const [expenseDate, setExpenseDate] = useState(new Date());
  const [tempDateInput, setTempDateInput] = useState(''); // 웹에서 임시 날짜 입력용

  useEffect(() => {
    initializeData();
  }, []);

  const initializeData = async () => {
    try {
      setLoading(true);
      
      const currentUser = getCurrentUser();
      if (!currentUser) {
        Alert.alert('오류', '로그인이 필요합니다.');
        router.replace('/auth/login');
        return;
      }

      if (!tripId || !expenseId || typeof tripId !== 'string' || typeof expenseId !== 'string') {
        Alert.alert('오류', '잘못된 접근입니다.');
        router.back();
        return;
      }

      // Get trip data
      const tripData = await getTripById(tripId);
      if (!tripData) {
        Alert.alert('오류', '여행 정보를 찾을 수 없습니다.');
        router.back();
        return;
      }
      setTrip(tripData);

      // Get trip expenses to find the specific expense
      const expenses = await getTripExpenses(tripId);
      const expense = expenses.find(exp => exp.id === expenseId);
      if (!expense) {
        Alert.alert('오류', '지출 정보를 찾을 수 없습니다.');
        router.back();
        return;
      }
      setOriginalExpense(expense);

      // Fetch participants data
      const participantUsers = await getUsersByIds(tripData.participants);
      setMembers(participantUsers);

      // Initialize form with existing expense data
      setDescription(expense.title);
      setTotalAmount(expense.amount.toString());
      setDisplayTotalAmount(formatDisplayAmount(expense.amount, expense.currency));
      setCurrency(expense.currency);
      setPaidBy(expense.paidBy);
      setMemo(expense.description || '');
      setExpenseDate(expense.date);

      // Initialize member amounts based on existing splitDetails or splitBetween
      let initialAmounts: MemberAmount[] = [];
      
      if (expense.splitDetails && expense.splitDetails.length > 0) {
        // If splitDetails exists, use that data
        setSplitMethod(expense.splitDetails.length === participantUsers.length ? 'equal' : 'custom');
        initialAmounts = participantUsers.map(user => {
          const splitDetail = expense.splitDetails!.find(split => split.userId === user.id);
          return {
            userId: user.id,
            name: user.name,
            amount: splitDetail ? splitDetail.amount : 0,
            percentage: splitDetail ? splitDetail.percentage : 0
          };
        });
      } else {
        // If using old splitBetween format
        setSplitMethod('equal');
        const splitAmount = expense.amount / expense.splitBetween.length;
        const splitPercentage = Math.round(100 / expense.splitBetween.length);
        
        initialAmounts = participantUsers.map(user => ({
          userId: user.id,
          name: user.name,
          amount: expense.splitBetween.includes(user.id) ? splitAmount : 0,
          percentage: expense.splitBetween.includes(user.id) ? splitPercentage : 0
        }));
      }
      
      setMemberAmounts(initialAmounts);
      
    } catch (error) {
      console.error('Error initializing data:', error);
      Alert.alert('오류', '데이터를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleCurrencySelect = (selectedCurrency: string) => {
    setCurrency(selectedCurrency);
    setCurrencyModalVisible(false);
  };

  const getCurrencyInfo = (code: string) => {
    return currencies.find(c => c.code === code) || currencies[0];
  };

  const handleAmountChange = (text: string) => {
    // Remove any non-numeric characters except dots and commas
    const cleanText = text.replace(/[^0-9.,]/g, '');
    
    // Parse the number (remove commas for calculation)
    const numericValue = parseFloat(cleanText.replace(/,/g, '')) || 0;
    
    setTotalAmount(numericValue.toString());
    setDisplayTotalAmount(formatDisplayAmount(numericValue, currency));
    
    // Update member amounts if using equal split
    if (splitMethod === 'equal') {
      updateEqualSplit(numericValue);
    }
  };

  const handleSplitMethodChange = (method: string) => {
    setSplitMethod(method);
    
    if (method === 'equal') {
      updateEqualSplit(parseFloat(totalAmount) || 0);
    }
  };

  const updateEqualSplit = (amount: number) => {
    const updatedAmounts = memberAmounts.map(member => ({
      ...member,
      amount: amount / members.length,
      percentage: Math.round(100 / members.length)
    }));
    setMemberAmounts(updatedAmounts);
  };

  const handleMemberAmountChange = (userId: string, textAmount: string) => {
    const numericValue = parseFloat(textAmount.replace(/,/g, '')) || 0;
    const updatedAmounts = memberAmounts.map(member =>
      member.userId === userId ? { ...member, amount: numericValue } : member
    );
    setMemberAmounts(updatedAmounts);
  };

  const handleMemberPercentageChange = (userId: string, percentage: number) => {
    const totalAmountNum = parseFloat(totalAmount) || 0;
    const amount = (totalAmountNum * percentage) / 100;
    
    const updatedAmounts = memberAmounts.map(member =>
      member.userId === userId 
        ? { ...member, percentage, amount } 
        : member
    );
    setMemberAmounts(updatedAmounts);
  };

  const validateForm = (): boolean => {
    if (!description.trim()) {
      Alert.alert('입력 오류', '지출 내용을 입력해주세요.');
      return false;
    }
    
    const amount = parseFloat(totalAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('입력 오류', '올바른 금액을 입력해주세요.');
      return false;
    }
    
    if (!paidBy) {
      Alert.alert('입력 오류', '결제자를 선택해주세요.');
      return false;
    }
    
    const totalMemberAmount = memberAmounts.reduce((sum, member) => sum + member.amount, 0);
    const difference = Math.abs(totalMemberAmount - amount);
    
    if (difference > 0.01) { // Allow small floating point differences
      Alert.alert('입력 오류', '분할 금액의 합계가 총 금액과 일치하지 않습니다.');
      return false;
    }
    
    return true;
  };

  const handleSave = async () => {
    if (!validateForm() || !originalExpense || !trip) return;
    
    try {
      setSaving(true);
      
      const amount = parseFloat(totalAmount);
      const splitDetails: ExpenseSplit[] = memberAmounts
        .filter(member => member.amount > 0)
        .map(member => ({
          userId: member.userId,
          amount: member.amount,
          percentage: member.percentage
        }));

      const expenseUpdate: Partial<Expense> = {
        title: description.trim(),
        amount,
        currency,
        paidBy,
        splitBetween: splitDetails.map(split => split.userId),
        splitDetails,
        description: memo.trim() || undefined,
        date: expenseDate,
      };
      
      await updateExpense(originalExpense.id, expenseUpdate);
      
      Alert.alert('수정 완료', '지출이 성공적으로 수정되었습니다.', [
        { text: '확인', onPress: () => router.back() }
      ]);
      
    } catch (error) {
      console.error('Error updating expense:', error);
      Alert.alert('오류', '지출 수정에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const getAvatarColor = (name: string) => {
    const colors = ['#4ECDC4', '#96CEB4', '#FF6B6B', '#45B7D1'];
    return colors[name.length % colors.length];
  };

  const renderMemberAmountItem = (member: MemberAmount) => (
    <View key={member.userId} style={styles.memberItem}>
      <View style={styles.memberInfo}>
        <View style={[styles.memberAvatar, { backgroundColor: getAvatarColor(member.name) }]}>
          <Text style={styles.memberAvatarText}>{member.name.charAt(0)}</Text>
        </View>
        <Text style={styles.memberName}>{member.name}</Text>
      </View>
      
      <View style={styles.memberInputs}>
        {splitMethod === 'unequal' ? (
          <View style={styles.percentageContainer}>
            <TextInput
              style={styles.percentageInput}
              value={member.percentage.toString()}
              onChangeText={(text) => {
                const percentage = parseInt(text) || 0;
                handleMemberPercentageChange(member.userId, Math.min(100, Math.max(0, percentage)));
              }}
              keyboardType="numeric"
              placeholder="0"
            />
            <Text style={styles.percentageSymbol}>%</Text>
          </View>
        ) : (
          <View style={styles.amountContainer}>
            <Text style={styles.currencySymbol}>{getCurrencyInfo(currency).symbol}</Text>
            <TextInput
              style={styles.amountInput}
              value={formatDisplayAmount(member.amount, currency)}
              onChangeText={(text) => handleMemberAmountChange(member.userId, text)}
              keyboardType="numeric"
              placeholder="0"
              editable={splitMethod !== 'equal'}
            />
          </View>
        )}
      </View>
    </View>
  );

  const renderSplitMethodItem = (method: any) => (
    <TouchableOpacity
      key={method.id}
      style={[
        styles.splitMethodItem,
        splitMethod === method.id && styles.splitMethodItemSelected
      ]}
      onPress={() => handleSplitMethodChange(method.id)}
    >
      <View style={styles.splitMethodInfo}>
        <Text style={[
          styles.splitMethodName,
          splitMethod === method.id && styles.splitMethodNameSelected
        ]}>
          {method.name}
        </Text>
        <Text style={styles.splitMethodDescription}>{method.description}</Text>
      </View>
    </TouchableOpacity>
  );

  const renderPayerSelector = () => (
    <View style={styles.payerContainer}>
      <Text style={styles.sectionTitle}>결제자</Text>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.payerScrollView}
      >
        {members.map((member) => (
          <TouchableOpacity
            key={member.id}
            style={[
              styles.payerItem,
              paidBy === member.id && styles.payerItemSelected
            ]}
            onPress={() => setPaidBy(member.id)}
          >
            <View style={[
              styles.payerAvatar,
              { backgroundColor: getAvatarColor(member.name) },
              paidBy === member.id && styles.payerAvatarSelected
            ]}>
              <Text style={[
                styles.payerAvatarText,
                paidBy === member.id && styles.payerAvatarTextSelected
              ]}>
                {member.name.charAt(0)}
              </Text>
            </View>
            <Text style={[
              styles.payerName,
              paidBy === member.id && styles.payerNameSelected
            ]}>
              {member.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      weekday: 'short'
    });
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    const currentDate = selectedDate || expenseDate;
    setShowDatePicker(Platform.OS === 'ios');
    setExpenseDate(currentDate);
  };

  const handleWebDateChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedDate = new Date(event.target.value);
    if (!isNaN(selectedDate.getTime())) {
      setExpenseDate(selectedDate);
    }
  };

  if (loading) {
    return (
      <TabLayout>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4A90E2" />
          <Text style={styles.loadingText}>지출 정보를 불러오는 중...</Text>
        </View>
      </TabLayout>
    );
  }

  return (
    <TabLayout>
      <KeyboardAvoidingView 
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>지출 수정하기</Text>
          <TouchableOpacity 
            onPress={handleSave} 
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Text style={styles.saveButtonText}>저장</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Trip Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>여행</Text>
            <View style={styles.tripSelector}>
              <View style={styles.tripIcon}>
                <Text style={styles.tripEmoji}>{trip?.emoji || '🌍'}</Text>
              </View>
              <Text style={styles.tripName}>{trip?.name || '여행'}</Text>
            </View>
          </View>

          {/* Date Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>날짜</Text>
            <TouchableOpacity 
              style={styles.dateSelector}
              onPress={() => {
                if (Platform.OS === 'web') {
                  hiddenDateInputRef.current?.click();
                } else {
                  setShowDatePicker(true);
                }
              }}
            >
              <Ionicons name="calendar-outline" size={20} color="#666" />
              <Text style={styles.dateText}>{formatDate(expenseDate)}</Text>
            </TouchableOpacity>
            
            {Platform.OS === 'web' && (
              <input
                ref={hiddenDateInputRef as any}
                type="date"
                style={{ display: 'none' }}
                onChange={handleWebDateChange}
                value={expenseDate.toISOString().split('T')[0]}
              />
            )}
            
            {showDatePicker && Platform.OS !== 'web' && RNDateTimePicker && (
              <RNDateTimePicker
                testID="dateTimePicker"
                value={expenseDate}
                mode="date"
                is24Hour={true}
                display="default"
                onChange={onDateChange}
              />
            )}
          </View>

          {/* Expense Description */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>지출 내용</Text>
            <TextInput
              style={styles.input}
              value={description}
              onChangeText={setDescription}
              placeholder="무엇을 구매했나요?"
              placeholderTextColor="#999"
            />
          </View>

          {/* Amount and Currency */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>금액</Text>
            <View style={styles.amountSection}>
              <TouchableOpacity 
                style={styles.currencySelector}
                onPress={() => setCurrencyModalVisible(true)}
              >
                <Text style={styles.currencyText}>{currency}</Text>
                <Ionicons name="chevron-down" size={16} color="#666" />
              </TouchableOpacity>
              <TextInput
                style={styles.amountInputLarge}
                value={displayTotalAmount}
                onChangeText={handleAmountChange}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor="#999"
              />
            </View>
          </View>

          {/* Payer Selection */}
          {renderPayerSelector()}

          {/* Split Method */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>분할 방법</Text>
            <View style={styles.splitMethodContainer}>
              {splitMethods.map(renderSplitMethodItem)}
            </View>
          </View>

          {/* Member Amounts */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>멤버별 금액</Text>
            <View style={styles.memberContainer}>
              {memberAmounts.map(renderMemberAmountItem)}
            </View>
          </View>

          {/* Memo */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>메모 (선택)</Text>
            <TextInput
              style={[styles.input, styles.memoInput]}
              value={memo}
              onChangeText={setMemo}
              placeholder="추가 메모를 입력하세요"
              placeholderTextColor="#999"
              multiline
              numberOfLines={3}
            />
          </View>
        </ScrollView>

        {/* Currency Selection Modal */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={currencyModalVisible}
          onRequestClose={() => setCurrencyModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>통화 선택</Text>
                <TouchableOpacity onPress={() => setCurrencyModalVisible(false)}>
                  <Ionicons name="close" size={24} color="#333" />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.currenciesList}>
                {currencies.map((curr) => (
                  <TouchableOpacity
                    key={curr.code}
                    style={[
                      styles.currencyItem,
                      currency === curr.code && styles.currencyItemSelected
                    ]}
                    onPress={() => handleCurrencySelect(curr.code)}
                  >
                    <Text style={styles.currencySymbol}>{curr.symbol}</Text>
                    <View style={styles.currencyInfo}>
                      <Text style={styles.currencyCode}>{curr.code}</Text>
                      <Text style={styles.currencyName}>{curr.name}</Text>
                    </View>
                    {currency === curr.code && (
                      <Ionicons name="checkmark" size={20} color="#4A90E2" />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </TabLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
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
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    flex: 1,
    textAlign: 'center',
  },
  saveButton: {
    backgroundColor: '#4A90E2',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 60,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  tripSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  tripIcon: {
    marginRight: 12,
  },
  tripEmoji: {
    fontSize: 24,
  },
  tripName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    flex: 1,
  },
  dateSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  dateText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 12,
  },
  input: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    color: '#333',
  },
  memoInput: {
    height: 80,
    textAlignVertical: 'top',
  },
  amountSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 12,
    overflow: 'hidden',
  },
  currencySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRightWidth: 1,
    borderRightColor: '#E5E5E5',
  },
  currencyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginRight: 8,
  },
  amountInputLarge: {
    flex: 1,
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    paddingHorizontal: 16,
    paddingVertical: 16,
    textAlign: 'right',
  },
  payerContainer: {
    marginBottom: 24,
  },
  payerScrollView: {
    paddingVertical: 8,
  },
  payerItem: {
    alignItems: 'center',
    marginRight: 16,
    paddingVertical: 8,
  },
  payerItemSelected: {
    transform: [{ scale: 1.05 }],
  },
  payerAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  payerAvatarSelected: {
    borderWidth: 3,
    borderColor: '#4A90E2',
  },
  payerAvatarText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
  },
  payerAvatarTextSelected: {
    color: 'white',
  },
  payerName: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  payerNameSelected: {
    color: '#4A90E2',
    fontWeight: '600',
  },
  splitMethodContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    overflow: 'hidden',
  },
  splitMethodItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  splitMethodItemSelected: {
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
  splitMethodNameSelected: {
    color: '#4A90E2',
    fontWeight: '600',
  },
  splitMethodDescription: {
    fontSize: 14,
    color: '#666',
  },
  memberContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    overflow: 'hidden',
  },
  memberItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  memberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  memberAvatarText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
  },
  memberName: {
    fontSize: 16,
    color: '#333',
  },
  memberInputs: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  currencySymbol: {
    fontSize: 16,
    color: '#666',
    marginRight: 8,
  },
  amountInput: {
    fontSize: 16,
    color: '#333',
    textAlign: 'right',
    minWidth: 80,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 6,
  },
  percentageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  percentageInput: {
    fontSize: 16,
    color: '#333',
    textAlign: 'right',
    minWidth: 60,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 6,
  },
  percentageSymbol: {
    fontSize: 16,
    color: '#666',
    marginLeft: 4,
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
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  currenciesList: {
    maxHeight: 400,
  },
  currencyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  currencyItemSelected: {
    backgroundColor: '#E3F2FD',
  },
  currencyInfo: {
    flex: 1,
    marginLeft: 12,
  },
  currencyCode: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  currencyName: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
}); 