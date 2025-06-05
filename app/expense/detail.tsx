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
  addExpense, 
  getTripById, 
  getUsersByIds, 
  getCurrentUser,
  getUserTrips
} from '../../services/firebaseService';
import { Trip, User, ExpenseCategory, ExpenseSplit } from '../../types';
import { fonts } from '../../styles/globalStyles';

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

// 지출 카테고리별 이모지 및 이름
const expenseCategories = [
  { id: ExpenseCategory.FOOD, name: '식사', emoji: '🍽️' },
  { id: ExpenseCategory.TRANSPORT, name: '교통비', emoji: '🚗' },
  { id: ExpenseCategory.ACCOMMODATION, name: '숙박', emoji: '🏨' },
  { id: ExpenseCategory.ENTERTAINMENT, name: '오락', emoji: '🎡' },
  { id: ExpenseCategory.SHOPPING, name: '쇼핑', emoji: '🛍️' },
  { id: ExpenseCategory.OTHER, name: '기타', emoji: '📝' },
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
    // Other currencies: preserve user input format, only add commas for thousands
    const inputStr = typeof amount === 'string' ? amount.replace(/,/g, '') : amount.toString();
    
    // Check if the input has decimal places
    if (inputStr.includes('.')) {
      const [integerPart, decimalPart] = inputStr.split('.');
      const formattedInteger = parseInt(integerPart).toLocaleString();
      return `${formattedInteger}.${decimalPart}`;
    } else {
      // No decimal places, just format with commas
      return num.toLocaleString();
    }
  }
};

// Helper function to parse a formatted amount string back to a number string (without commas)
const parseDisplayAmount = (formattedAmount: string): string => {
  return formattedAmount.replace(/,/g, '');
};

export default function ExpenseDetailScreen() {
  const { tripId, tripName, ocrAmount, ocrDescription, ocrConfidence, ocrError } = useLocalSearchParams();
  const hiddenDateInputRef = useRef<HTMLInputElement>(null);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [userTrips, setUserTrips] = useState<Trip[]>([]);
  const [tripSelectionModalVisible, setTripSelectionModalVisible] = useState(false);
  const [members, setMembers] = useState<User[]>([]);
  const [memberAmounts, setMemberAmounts] = useState<MemberAmount[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currencyModalVisible, setCurrencyModalVisible] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);

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
  const [selectedCategory, setSelectedCategory] = useState<ExpenseCategory>(ExpenseCategory.OTHER);

  useEffect(() => {
    initializeData();
  }, []);

  useEffect(() => {
    // OCR 결과 처리 개선
    console.log('=== OCR Results Processing ===');
    console.log('OCR Amount:', ocrAmount);
    console.log('OCR Description:', ocrDescription);
    console.log('OCR Confidence:', ocrConfidence);
    console.log('OCR Error:', ocrError);
    
    if (ocrAmount && typeof ocrAmount === 'string') {
      const cleanAmount = ocrAmount.replace(/[^0-9.]/g, ''); // 숫자와 소수점만 추출
      if (cleanAmount && !isNaN(parseFloat(cleanAmount))) {
        console.log('Setting OCR amount:', cleanAmount);
        setTotalAmount(cleanAmount);
        setDisplayTotalAmount(formatDisplayAmount(cleanAmount, currency));
      }
    }
    
    if (ocrDescription && typeof ocrDescription === 'string' && ocrDescription.trim()) {
      console.log('Setting OCR description:', ocrDescription);
      setDescription(ocrDescription.trim());
    }
    
    // OCR 오류가 있었다면 사용자에게 알림
    if (ocrError === 'true') {
      setTimeout(() => {
        Alert.alert(
          'OCR 처리 실패',
          'OCR로 영수증을 인식하지 못했습니다. 수동으로 입력해주세요.',
          [{ text: '확인' }]
        );
      }, 1000);
    } else if (ocrAmount || ocrDescription) {
      // OCR 성공 시 알림
      setTimeout(() => {
        const confidence = ocrConfidence ? `(신뢰도: ${Math.round(parseFloat(ocrConfidence) * 100)}%)` : '';
        Alert.alert(
          '✅ OCR 완료',
          `영수증 정보가 자동으로 입력되었습니다. ${confidence}\n\n수정이 필요하면 직접 편집해주세요.`,
          [{ text: '확인' }]
        );
      }, 1000);
    }
  }, [ocrAmount, ocrDescription, ocrConfidence, ocrError, currency]);

  const initializeData = async () => {
    try {
      setLoading(true);
      
      const currentUser = getCurrentUser();
      if (!currentUser) {
        Alert.alert('오류', '로그인이 필요합니다.');
        router.replace('/auth/login');
        return;
      }

      // 사용자의 모든 여행 가져오기
      const trips = await getUserTrips(currentUser.uid);
      setUserTrips(trips);

      // tripId가 있으면 해당 여행 선택, 없으면 가장 최근 여행 선택
      let selectedTrip: Trip | null = null;
      
      if (tripId && typeof tripId === 'string') {
        selectedTrip = trips.find(t => t.id === tripId) || null;
      }
      
      if (!selectedTrip && trips.length > 0) {
        // 가장 최근에 생성된 여행 선택
        selectedTrip = trips.sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )[0];
      }

      if (selectedTrip) {
        await selectTrip(selectedTrip);
      } else {
        Alert.alert('알림', '등록된 여행이 없습니다. 먼저 여행을 생성해주세요.', [
          { text: '확인', onPress: () => router.replace('/trip/create') }
        ]);
      }
    } catch (error) {
      console.error('Error initializing data:', error);
      Alert.alert('오류', '데이터를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const selectTrip = async (selectedTrip: Trip) => {
    try {
      setTrip(selectedTrip);
      setCurrency(selectedTrip.currency);
      
      // Fetch participants data
      const participantUsers = await getUsersByIds(selectedTrip.participants);
      setMembers(participantUsers);
      
      // Initialize member amounts
      const initialAmounts = participantUsers.map(user => ({
        userId: user.id,
        name: user.name,
        amount: 0,
        percentage: Math.round(100 / participantUsers.length)
      }));
      setMemberAmounts(initialAmounts);
      
      // Set first member as default payer
      if (participantUsers.length > 0) {
        setPaidBy(participantUsers[0].id);
      }
      
    } catch (error) {
      console.error('Error selecting trip:', error);
      Alert.alert('오류', '여행 정보를 불러오는데 실패했습니다.');
    }
  };

  const handleTripSelection = (selectedTrip: Trip) => {
    selectTrip(selectedTrip);
    setTripSelectionModalVisible(false);
  };

  const handleCurrencySelect = (selectedCurrency: string) => {
    setCurrency(selectedCurrency);
    setCurrencyModalVisible(false);
  };

  const handleCategorySelect = (category: ExpenseCategory) => {
    setSelectedCategory(category);
    setCategoryModalVisible(false);
  };

  const getCurrencyInfo = (code: string) => {
    return currencies.find(c => c.code === code) || currencies[0];
  };

  const getCategoryInfo = (categoryId: ExpenseCategory) => {
    return expenseCategories.find(cat => cat.id === categoryId) || expenseCategories[5]; // default to OTHER
  };

  const handleCameraCapture = () => {
    router.push({
      pathname: '/expense/camera',
      params: { tripId, tripName }
    });
  };

  const handleAmountChange = (text: string) => {
    const rawValue = parseDisplayAmount(text);
    if (/^\d*\.?\d*$/.test(rawValue) || rawValue === '') { // Allow numbers and a single decimal point
      setTotalAmount(rawValue); // Store raw number string
      
      // For display formatting, use the raw input to preserve decimal places as entered
      if (rawValue === '') {
        setDisplayTotalAmount('0');
      } else if (rawValue === '.') {
        setDisplayTotalAmount('0.');
      } else {
        setDisplayTotalAmount(formatDisplayAmount(rawValue, currency));
      }
      
      // Update member amounts if split method is equal
      if (splitMethod === 'equal' && rawValue) {
        const numAmount = parseFloat(rawValue) || 0;
        const memberCount = memberAmounts.length > 0 ? memberAmounts.length : 1;
        const perPersonAmount = numAmount / memberCount;
        setMemberAmounts(memberAmounts.map(member => ({
          ...member,
          amount: perPersonAmount,
          percentage: Math.round(100 / memberCount)
        })));
      }
    }
  };

  const handleSplitMethodChange = (method: string) => {
    setSplitMethod(method);
    const numAmount = parseFloat(totalAmount) || 0; // Use raw totalAmount for calculation
    const memberCount = memberAmounts.length > 0 ? memberAmounts.length : 1;

    if (method === 'equal') {
      const perPersonAmount = numAmount / memberCount;
      setMemberAmounts(memberAmounts.map(member => ({
        ...member,
        amount: perPersonAmount,
        percentage: Math.round(100 / memberCount)
      })));
    }
    // For other methods, amounts might be manually set or calculated differently
  };

  const handleMemberAmountChange = (userId: string, textAmount: string) => {
    const rawAmount = parseDisplayAmount(textAmount);
    const numAmount = parseFloat(rawAmount) || 0;
    const totalAmountNum = parseFloat(totalAmount) || 0; // Use raw totalAmount
    const percentage = totalAmountNum > 0 ? (numAmount / totalAmountNum) * 100 : 0;
    
    setMemberAmounts(memberAmounts.map(member => 
      member.userId === userId 
        ? { ...member, amount: numAmount, percentage } // Store raw amount
        : member
    ));
  };

  const handleMemberPercentageChange = (userId: string, percentage: number) => {
    const totalAmountNum = parseFloat(totalAmount) || 0; // Use raw totalAmount
    const amount = (totalAmountNum * percentage) / 100;
    setMemberAmounts(memberAmounts.map(member => 
      member.userId === userId 
        ? { ...member, percentage, amount } // Store raw amount
        : member
    ));
  };

  useEffect(() => {
    // Update displayTotalAmount when currency changes
    if (totalAmount === '') {
      setDisplayTotalAmount('0');
    } else if (totalAmount === '.') {
      setDisplayTotalAmount('0.');
    } else {
      setDisplayTotalAmount(formatDisplayAmount(totalAmount, currency));
    }
  }, [currency, totalAmount]); // Add totalAmount here to reformat if it changes programmatically

  const validateForm = (): boolean => {
    if (!description.trim()) {
      Alert.alert('오류', '내용을 입력해주세요.');
      return false;
    }

    if (!totalAmount || parseFloat(totalAmount) <= 0) {
      Alert.alert('오류', '올바른 금액을 입력해주세요.');
      return false;
    }

    if (!paidBy) {
      Alert.alert('오류', '결제자를 선택해주세요.');
      return false;
    }

    const totalSplitAmount = memberAmounts.reduce((sum, member) => sum + member.amount, 0);
    const expectedAmount = parseFloat(totalAmount);
    
    if (Math.abs(totalSplitAmount - expectedAmount) > 0.01) {
      Alert.alert('오류', '분할 금액의 합이 총 금액과 일치하지 않습니다.');
      return false;
    }

    return true;
  };

  const handleSave = async () => {
    if (!validateForm()) return;
    if (!trip) return;

    setSaving(true);
    try {
      const currentUser = getCurrentUser();
      if (!currentUser) {
        Alert.alert('오류', '로그인이 필요합니다.');
        return;
      }

      const expenseData = {
        tripId: trip.id,
        title: description,
        description: memo,
        amount: parseFloat(totalAmount),
        currency,
        paidBy,
        splitBetween: memberAmounts.map(m => m.userId),
        splitDetails: memberAmounts.map(m => ({
          userId: m.userId,
          amount: m.amount,
          percentage: m.percentage
        })),
        splitMethod,
        category: selectedCategory,
        date: expenseDate,
        createdAt: new Date()
      };

      await addExpense(expenseData);
      router.replace(`/trip/${trip.id}`);
    } catch (error: any) {
      Alert.alert('오류', '지출 추가에 실패했습니다: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const getAvatarColor = (name: string) => {
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFA726'];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  const renderMemberAmountItem = (member: MemberAmount) => (
    <View key={member.userId} style={styles.memberItem}>
      <View style={styles.memberInfo}>
        <View style={[styles.memberAvatar, { backgroundColor: getAvatarColor(member.name) }]}>
          <Text style={styles.memberAvatarText}>{member.name.charAt(0)}</Text>
        </View>
        <Text style={styles.memberName}>{member.name}</Text>
      </View>
      
      <View style={styles.memberAmountContainer}>
        {splitMethod === 'custom' && (
          <TextInput
            style={styles.memberAmountInput}
            value={formatDisplayAmount(member.amount, currency)}
            onChangeText={(value) => handleMemberAmountChange(member.userId, value)}
            placeholder={formatDisplayAmount(0, currency)}
            keyboardType="numeric"
          />
        )}
        
        {splitMethod === 'unequal' && (
          <View style={styles.percentageContainer}>
            <TextInput
              style={styles.percentageInput}
              value={member.percentage > 0 ? member.percentage.toString() : ''}
              onChangeText={(value) => handleMemberPercentageChange(member.userId, parseFloat(value) || 0)}
              placeholder="0"
              keyboardType="numeric"
            />
            <Text style={styles.percentageSymbol}>%</Text>
          </View>
        )}
        
        <Text style={styles.memberAmountText}>
          {getCurrencyInfo(currency).symbol} {formatDisplayAmount(member.amount, currency)}
        </Text>
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
      <View style={styles.radioButton}>
        {splitMethod === method.id && <View style={styles.radioButtonSelected} />}
      </View>
      <View style={styles.splitMethodInfo}>
        <Text style={styles.splitMethodName}>{method.name}</Text>
        <Text style={styles.splitMethodDescription}>{method.description}</Text>
      </View>
    </TouchableOpacity>
  );

  const renderPayerSelector = () => (
    <View style={styles.payerSelectorContainer}>
      <Text style={styles.label}>누가 결제했나요?</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.payerScrollView}>
        {members.map((member) => (
          <TouchableOpacity
            key={member.id}
            style={[
              styles.payerOption,
              paidBy === member.id && styles.payerOptionSelected
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

  // Date formatting function
  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'short'
    });
  };

  // DateTimePicker onChange handler
  const onDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'web') {
      // Web에서는 input[type="date"]의 onChange 이벤트 처리
      if (selectedDate) {
        setExpenseDate(selectedDate);
      }
      return;
    }

    // 모바일에서의 DateTimePicker 이벤트 처리
    const { type } = event;
    if (Platform.OS === 'android') {
      setShowDatePicker(false); // Always close for Android after any interaction
    }
    if (type === 'set') { // Date was selected
      if (selectedDate) {
        setExpenseDate(selectedDate);
      }
      if (Platform.OS === 'ios') {
        setShowDatePicker(false); // Close for iOS only if a date was set
      }
    } else if (type === 'dismissed' && Platform.OS === 'ios') {
        setShowDatePicker(false); // Close for iOS if dismissed
    }
  };

  if (loading) {
    return (
      <TabLayout>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>지출 추가하기</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4A90E2" />
          <Text style={styles.loadingText}>여행 정보 불러오는 중...</Text>
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
          <Text style={styles.headerTitle}>지출 추가하기</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <TouchableOpacity 
            style={styles.tripInfo} 
            onPress={() => setTripSelectionModalVisible(true)}
          >
            <View style={styles.tripIcon}>
              {trip?.emoji ? (
                <Text style={styles.tripEmoji}>{trip.emoji}</Text>
              ) : (
                <Ionicons name="airplane" size={20} color="white" />
              )}
            </View>
            <View style={styles.tripDetails}>
              <Text style={styles.tripName}>{trip?.name || '여행을 선택해주세요'}</Text>
              <Text style={styles.tripSubtext}>탭하여 여행 변경</Text>
            </View>
            <Ionicons name="chevron-down" size={20} color="#666" />
          </TouchableOpacity>

          {/* 1. 내용 작성 섹션 (최상단) */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>내용을 작성해주세요</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.descriptionInput}
                value={description}
                onChangeText={setDescription}
                placeholder="어떤 항목인지 입력해주세요"
                multiline
              />
            </View>
          </View>

          {/* 1.5. 날짜 선택 섹션 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>언제 지출했나요?</Text>
            {Platform.OS === 'web' ? (
              // 웹에서는 직접 입력과 캘린더 선택을 분리
              <View style={styles.dateSelector}>
                <View style={styles.dateSelectorContent}>
                  {/* 캘린더 아이콘 영역 - 날짜 선택기 input과 겹치게 */}
                  <View style={{ position: 'relative', zIndex: 1 }}>
                    <Ionicons name="calendar" size={20} color="#4A90E2" />
                    <input
                      ref={hiddenDateInputRef as any}
                      type="date"
                      value={expenseDate.toISOString().split('T')[0]}
                      onChange={(e) => {
                        const newDate = new Date(e.target.value);
                        if (!isNaN(newDate.getTime())) {
                          setExpenseDate(newDate);
                          setTempDateInput('');
                        }
                      }}
                      style={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        width: '100%',
                        height: '100%',
                        opacity: 0,
                        cursor: 'pointer',
                      }}
                    />
                  </View>
                  
                  <input
                    type="text"
                    value={tempDateInput || expenseDate.toISOString().split('T')[0]}
                    onChange={(e) => {
                      setTempDateInput(e.target.value);
                      
                      // YYYY-MM-DD 형식이 완성되면 즉시 적용
                      const datePattern = /^\d{4}-\d{2}-\d{2}$/;
                      if (datePattern.test(e.target.value)) {
                        const newDate = new Date(e.target.value);
                        if (!isNaN(newDate.getTime())) {
                          setExpenseDate(newDate);
                          setTempDateInput('');
                        }
                      }
                    }}
                    onFocus={() => {
                      setTempDateInput(expenseDate.toISOString().split('T')[0]);
                    }}
                    onBlur={() => {
                      setTempDateInput('');
                    }}
                    placeholder="YYYY-MM-DD"
                    style={{
                      marginLeft: 8,
                      marginRight: 8,
                      fontSize: 16,
                      fontWeight: '600',
                      color: '#333',
                      border: 'none',
                      background: 'transparent',
                      outline: 'none',
                      cursor: 'text',
                      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                      flex: 1,
                      textAlign: 'center',
                    }}
                  />
                  
                  {/* 드롭다운 화살표 영역 - 날짜 선택기 input과 겹치게 */}
                  <View style={{ position: 'relative', zIndex: 1 }}>
                    <Ionicons name="chevron-down" size={16} color="#666" />
                    <input
                      type="date"
                      value={expenseDate.toISOString().split('T')[0]}
                      onChange={(e) => {
                        const newDate = new Date(e.target.value);
                        if (!isNaN(newDate.getTime())) {
                          setExpenseDate(newDate);
                          setTempDateInput('');
                        }
                      }}
                      style={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        width: '100%',
                        height: '100%',
                        opacity: 0,
                        cursor: 'pointer',
                      }}
                    />
                  </View>
                </View>
              </View>
            ) : (
              // 모바일에서는 TouchableOpacity + DateTimePicker 사용
              <>
                <TouchableOpacity
                  style={styles.dateSelector}
                  onPress={() => setShowDatePicker(true)}
                >
                  <View style={styles.dateSelectorContent}>
                    <Ionicons name="calendar" size={20} color="#4A90E2" />
                    <Text style={styles.dateText}>{formatDate(expenseDate)}</Text>
                    <Ionicons name="chevron-down" size={16} color="#666" />
                  </View>
                </TouchableOpacity>
                {showDatePicker && RNDateTimePicker && (
                  <RNDateTimePicker
                    testID="dateTimePicker"
                    value={expenseDate}
                    mode="date"
                    display="default"
                    onChange={onDateChange}
                  />
                )}
              </>
            )}
          </View>

          {/* 2. 금액 입력 섹션 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>금액을 입력해주세요</Text>
            <View style={styles.amountContainer}>
              <View style={styles.amountInputContainer}>
                <TouchableOpacity 
                  style={styles.currencySelector}
                  onPress={() => setCurrencyModalVisible(true)}
                >
                  <Text style={styles.currencyText}>{getCurrencyInfo(currency).code}</Text>
                  <Ionicons name="chevron-down" size={16} color="#666" style={styles.currencyIcon} />
                </TouchableOpacity>
                <TextInput
                  style={styles.amountInput}
                  value={displayTotalAmount}
                  onChangeText={handleAmountChange}
                  placeholder={formatDisplayAmount(0, currency)}
                  keyboardType="numeric"
                />
                <TouchableOpacity 
                  style={styles.cameraButton}
                  onPress={handleCameraCapture}
                >
                  <Ionicons name="camera" size={20} color="#4A90E2" />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* 2.5. 카테고리 선택 섹션 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>카테고리를 선택해주세요</Text>
            <TouchableOpacity
              style={styles.categorySelector}
              onPress={() => setCategoryModalVisible(true)}
            >
              <Text style={styles.categoryEmoji}>{getCategoryInfo(selectedCategory).emoji}</Text>
              <Text style={styles.categoryText}>{getCategoryInfo(selectedCategory).name}</Text>
              <Ionicons name="chevron-down" size={16} color="#666" />
            </TouchableOpacity>
          </View>

          {/* 3. 결제자 선택 (금액 입력 후에만 표시) */}
          {totalAmount && parseFloat(totalAmount) > 0 && (
            <>
              <View style={styles.section}>
                {renderPayerSelector()}
              </View>

              {/* 4. 정산 방식 선택 */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>어떻게 정산하고 싶으신가요?</Text>
                <View style={styles.splitMethodsContainer}>
                  {splitMethods.map(renderSplitMethodItem)}
                </View>
              </View>

              {/* 5. 멤버별 금액 표시 */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>각자 내야 할 금액</Text>
                <View style={styles.membersContainer}>
                  {memberAmounts.map(renderMemberAmountItem)}
                </View>
                
                <View style={styles.totalSummary}>
                  <Text style={styles.totalSummaryText}>
                    총합: {getCurrencyInfo(currency).symbol} {formatDisplayAmount(memberAmounts.reduce((sum, m) => sum + m.amount, 0), currency)}
                  </Text>
                </View>
              </View>

              {/* 6. 메모 (선택사항) */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>메모 (선택사항)</Text>
                <TextInput
                  style={styles.memoInput}
                  value={memo}
                  onChangeText={setMemo}
                  placeholder="추가 설명이 있다면 입력해주세요"
                  multiline
                />
              </View>
            </>
          )}

          {/* 저장 버튼 */}
          {totalAmount && parseFloat(totalAmount) > 0 && paidBy && (
            <TouchableOpacity
              style={[styles.saveButton, saving && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={saving}
            >
              <Text style={styles.saveButtonText}>
                {saving ? '저장 중...' : '저장'}
              </Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Currency Selection Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={currencyModalVisible}
        onRequestClose={() => setCurrencyModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.currencyModalContent}>
            <View style={styles.currencyModalHeader}>
              <Text style={styles.currencyModalTitle}>화폐 선택</Text>
              <TouchableOpacity onPress={() => setCurrencyModalVisible(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.currencyList}>
              {currencies.map((currencyItem) => (
                <TouchableOpacity
                  key={currencyItem.code}
                  style={[
                    styles.currencyItem,
                    currency === currencyItem.code && styles.currencyItemSelected
                  ]}
                  onPress={() => handleCurrencySelect(currencyItem.code)}
                >
                  <View style={styles.currencyItemLeft}>
                    <Text style={styles.currencySymbol}>{currencyItem.symbol}</Text>
                    <View>
                      <Text style={styles.currencyCode}>{currencyItem.code}</Text>
                      <Text style={styles.currencyName}>{currencyItem.name}</Text>
                    </View>
                  </View>
                  {currency === currencyItem.code && (
                    <Ionicons name="checkmark" size={20} color="#4A90E2" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Trip Selection Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={tripSelectionModalVisible}
        onRequestClose={() => setTripSelectionModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.tripModalContent}>
            <View style={styles.tripModalHeader}>
              <Text style={styles.tripModalTitle}>여행 선택</Text>
              <TouchableOpacity onPress={() => setTripSelectionModalVisible(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.tripList}>
              {userTrips.map((tripItem) => (
                <TouchableOpacity
                  key={tripItem.id}
                  style={[
                    styles.tripItem,
                    trip?.id === tripItem.id && styles.tripItemSelected
                  ]}
                  onPress={() => handleTripSelection(tripItem)}
                >
                  <View style={styles.tripItemIcon}>
                    {tripItem.emoji ? (
                      <Text style={styles.tripEmoji}>{tripItem.emoji}</Text>
                    ) : (
                      <Ionicons name="airplane" size={20} color="white" />
                    )}
                  </View>
                  <View style={styles.tripItemInfo}>
                    <Text style={styles.tripItemName}>{tripItem.name}</Text>
                    <Text style={styles.tripItemDate}>
                      {new Date(tripItem.startDate).toLocaleDateString()} - {new Date(tripItem.endDate).toLocaleDateString()}
                    </Text>
                    <Text style={styles.tripItemCurrency}>{tripItem.currency}</Text>
                  </View>
                  {trip?.id === tripItem.id && (
                    <Ionicons name="checkmark" size={20} color="#4A90E2" />
                  )}
                </TouchableOpacity>
              ))}
              
              {userTrips.length === 0 && (
                <View style={styles.noTripsContainer}>
                  <Ionicons name="airplane-outline" size={50} color="#ccc" />
                  <Text style={styles.noTripsText}>등록된 여행이 없습니다</Text>
                  <TouchableOpacity 
                    style={styles.createTripButton}
                    onPress={() => {
                      setTripSelectionModalVisible(false);
                      router.push('/trip/create');
                    }}
                  >
                    <Text style={styles.createTripButtonText}>새 여행 만들기</Text>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Category Selection Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={categoryModalVisible}
        onRequestClose={() => setCategoryModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.categoryModalContent}>
            <View style={styles.categoryModalHeader}>
              <Text style={styles.categoryModalTitle}>카테고리 선택</Text>
              <TouchableOpacity onPress={() => setCategoryModalVisible(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.categoryList}>
              {expenseCategories.map((categoryItem) => (
                <TouchableOpacity
                  key={categoryItem.id}
                  style={[
                    styles.categoryItem,
                    selectedCategory === categoryItem.id && styles.categoryItemSelected
                  ]}
                  onPress={() => handleCategorySelect(categoryItem.id)}
                >
                  <Text style={styles.categoryItemEmoji}>{categoryItem.emoji}</Text>
                  <Text style={styles.categoryItemName}>{categoryItem.name}</Text>
                  {selectedCategory === categoryItem.id && (
                    <Ionicons name="checkmark" size={20} color="#4A90E2" />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>
    </TabLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 0,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: 'white',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  tripInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'white',
    marginBottom: 20,
  },
  tripIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#4A90E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  tripEmoji: {
    fontSize: 20,
  },
  tripDetails: {
    flex: 1,
  },
  tripName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  tripSubtext: {
    fontSize: 14,
    color: '#666',
  },
  section: {
    backgroundColor: 'white',
    marginBottom: 20,
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  inputContainer: {
    marginBottom: 16,
  },
  descriptionInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 50,
    textAlignVertical: 'top',
  },
  amountContainer: {
    alignItems: 'center',
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    overflow: 'hidden',
  },
  currencySelector: {
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRightWidth: 1,
    borderRightColor: '#e0e0e0',
    flexDirection: 'row',
    alignItems: 'center',
  },
  currencyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  currencyIcon: {
    marginLeft: 8,
  },
  amountInput: {
    flex: 1,
    padding: 12,
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
  },
  cameraButton: {
    padding: 8,
  },
  payerSelectorContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  payerScrollView: {
    maxHeight: 100,
  },
  payerOption: {
    alignItems: 'center',
    marginRight: 16,
    padding: 8,
    borderRadius: 8,
  },
  payerOptionSelected: {
    backgroundColor: '#E3F2FD',
  },
  payerAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  payerAvatarSelected: {
    borderWidth: 2,
    borderColor: '#4A90E2',
  },
  payerAvatarText: {
    fontSize: 18,
    fontWeight: '600',
    color: 'white',
  },
  payerAvatarTextSelected: {
    color: 'white',
  },
  payerName: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  payerNameSelected: {
    color: '#4A90E2',
    fontWeight: '600',
  },
  splitMethodsContainer: {
    marginBottom: 20,
  },
  splitMethodItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  splitMethodItemSelected: {
    borderColor: '#4A90E2',
    backgroundColor: '#E3F2FD',
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioButtonSelected: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#4A90E2',
  },
  splitMethodInfo: {
    flex: 1,
  },
  splitMethodName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  splitMethodDescription: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  membersContainer: {
    marginBottom: 16,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  memberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  memberAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  memberAvatarText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
  },
  memberName: {
    fontSize: 16,
    color: '#333',
  },
  memberAmountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberAmountInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 14,
    width: 70,
    textAlign: 'center',
    marginRight: 8,
  },
  percentageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  percentageInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 14,
    width: 50,
    textAlign: 'center',
  },
  percentageSymbol: {
    fontSize: 14,
    color: '#666',
    marginLeft: 4,
  },
  memberAmountText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4A90E2',
    minWidth: 70,
    textAlign: 'right',
  },
  totalSummary: {
    borderTopWidth: 2,
    borderTopColor: '#4A90E2',
    paddingTop: 12,
    alignItems: 'center',
  },
  totalSummaryText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4A90E2',
  },
  memoInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  saveButton: {
    backgroundColor: '#4A90E2',
    marginHorizontal: 20,
    marginBottom: 30,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#ccc',
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  currencyModalContent: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 10,
    width: '80%',
    maxHeight: '80%',
  },
  currencyModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  currencyModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  currencyList: {
    maxHeight: 200,
  },
  currencyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  currencyItemSelected: {
    backgroundColor: '#E3F2FD',
  },
  currencyItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  currencySymbol: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginRight: 8,
  },
  currencyCode: {
    fontSize: 14,
    color: '#666',
  },
  currencyName: {
    fontSize: 14,
    color: '#666',
  },
  tripModalContent: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 10,
    width: '80%',
    maxHeight: '80%',
  },
  tripModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  tripModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  tripList: {
    maxHeight: 200,
  },
  tripItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  tripItemSelected: {
    backgroundColor: '#E3F2FD',
  },
  tripItemIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#4A90E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  tripItemInfo: {
    flex: 1,
  },
  tripItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  tripItemDate: {
    fontSize: 14,
    color: '#666',
  },
  tripItemCurrency: {
    fontSize: 14,
    color: '#666',
  },
  noTripsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noTripsText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
  },
  createTripButton: {
    backgroundColor: '#4A90E2',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  createTripButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  dateSelector: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
  },
  dateSelectorContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateText: {
    marginLeft: 8,
    marginRight: 8,
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  categorySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    backgroundColor: 'white',
  },
  categoryEmoji: {
    fontSize: 20,
    marginRight: 8,
  },
  categoryText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  categoryModalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '60%',
    width: '100%',
    paddingBottom: 20,
  },
  categoryModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  categoryModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  categoryList: {
    paddingHorizontal: 20,
  },
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  categoryItemSelected: {
    backgroundColor: '#E3F2FD',
  },
  categoryItemEmoji: {
    fontSize: 24,
    marginRight: 12,
  },
  categoryItemName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
}); 