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
  Image,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  ImageStyle,
  StyleProp,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import TabLayout from '../../components/TabLayout';
import { CURRENCIES } from '../../constants/Currency';
import { 
  onAuthStateChange, 
  getCurrentUser, 
  getTripMembers,
  addExpense 
} from '../../services/firebaseService';
import { getAvatarColor } from '../../utils/colors';
import { ExpenseCategory } from '../../types';

const members = [
  { id: '1', name: '김윤정', avatar: '김', amount: 0, percentage: 25 },
  { id: '2', name: 'Junsu', avatar: 'J', amount: 0, percentage: 25 },
  { id: '3', name: 'ВИКАЭМ', avatar: 'В', amount: 0, percentage: 25 },
  { id: '4', name: '지한', avatar: '지', amount: 0, percentage: 25 },
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

type Styles = {
  container: ViewStyle;
  header: ViewStyle;
  backButton: ViewStyle;
  headerTitle: StyleProp<TextStyle>;
  content: ViewStyle;
  tripInfo: ViewStyle;
  tripIcon: ViewStyle;
  tripName: TextStyle;
  section: ViewStyle;
  sectionTitle: TextStyle;
  inputContainer: ViewStyle;
  label: TextStyle;
  input: TextStyle;
  memberItem: ViewStyle;
  memberAvatar: ViewStyle;
  memberAvatarText: TextStyle;
  memberInfo: ViewStyle;
  memberName: TextStyle;
  memberAmount: TextStyle;
  splitMethodsContainer: ViewStyle;
  splitMethodButton: ViewStyle;
  splitMethodButtonActive: ViewStyle;
  splitMethodText: TextStyle;
  splitMethodTextActive: TextStyle;
  amountContainer: ViewStyle;
  amountInputContainer: ViewStyle;
  currencySelector: ViewStyle;
  currencyText: TextStyle;
  amountInput: TextStyle;
  saveButton: ViewStyle;
  saveButtonDisabled: ViewStyle;
  saveButtonText: TextStyle;
  row: ViewStyle;
  flex1: ViewStyle;
  currencyContainer: ViewStyle;
  currencyButton: ViewStyle;
  payerContainer: ViewStyle;
  payerItem: ViewStyle;
  selectedPayerItem: ViewStyle;
  payerAvatar: ViewStyle;
  payerAvatarText: TextStyle;
  payerName: TextStyle;
  splitContainer: ViewStyle;
  splitMethodContainer: ViewStyle;
  splitMethodItem: ViewStyle;
  selectedSplitMethod: ViewStyle;
  splitMethodDescription: TextStyle;
  membersContainer: ViewStyle;
  memberSplitItem: ViewStyle;
  splitInputContainer: ViewStyle;
  splitInput: TextStyle;
  splitAmount: TextStyle;
  totalContainer: ViewStyle;
  totalText: TextStyle;
  modalContainer: ViewStyle;
  modalHeader: ViewStyle;
  modalCancelText: TextStyle;
  modalTitle: TextStyle;
  placeholder: ViewStyle;
  currencyItem: ViewStyle;
  currencyCode: TextStyle;
  currencyName: TextStyle;
  selectedMemberItem: ViewStyle;
  ocrStatusContainer: ViewStyle;
  ocrHeader: ViewStyle;
  ocrStatusText: TextStyle;
  ocrResultRow: ViewStyle;
  ocrLabel: TextStyle;
  ocrValue: TextStyle;
  ocrConfidence: TextStyle;
  ocrWarning: TextStyle;
  ocrIndicator: ViewStyle;
  ocrFilledInput: ViewStyle;
  receiptImageContainer: ViewStyle;
  imageWrapper: ViewStyle;
  receiptImage: ImageStyle;
  loadingContainer: ViewStyle;
  loadingText: TextStyle;
  payerScrollView: ViewStyle;
  selectedIndicator: ViewStyle;
  emptyMembersContainer: ViewStyle;
  emptyMembersText: TextStyle;
  inputWithLabel: ViewStyle;
  inputUnit: TextStyle;
  percentageTotal: TextStyle;
  paidByContainer: ViewStyle;
  paidBySelector: ViewStyle;
  paidByName: TextStyle;
  expandButton: ViewStyle;
  modalOverlay: ViewStyle;
  modalContent: ViewStyle;
  customInputContainer: ViewStyle;
  currencySymbol: StyleProp<TextStyle>;
  customSplitInput: StyleProp<TextStyle>;
  percentageIndicator: StyleProp<TextStyle>;
  remainingAmount: StyleProp<TextStyle>;
  remainingAmountWarning: StyleProp<TextStyle>;
  percentageInputContainer: ViewStyle;
  calculatedAmount: TextStyle;
};

export default function ExpenseDetailScreen() {
  const { tripId, tripName, scannedAmount, detectedCurrency, ocrConfidence, receiptImage } = useLocalSearchParams();
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [selectedCurrency, setSelectedCurrency] = useState(CURRENCIES[0]);
  const [showCurrencyModal, setShowCurrencyModal] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedPayer, setSelectedPayer] = useState('');
  const [splitMethod, setSplitMethod] = useState(SPLIT_METHODS[0]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [ocrInfo, setOcrInfo] = useState<{amount?: string, currency?: string, confidence?: number}>({});

  useEffect(() => {
    // Auth state listener 설정
    const unsubscribe = onAuthStateChange((user) => {
      setCurrentUser(user);
      if (!user) {
        router.replace('/auth/login');
      }
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    // OCR 결과 처리
    if (scannedAmount || detectedCurrency || ocrConfidence) {
      const confidence = parseFloat(ocrConfidence as string) || 0;
      setOcrInfo({
        amount: scannedAmount as string,
        currency: detectedCurrency as string,
        confidence
      });

      // OCR 결과로 자동 채우기
      if (scannedAmount && parseFloat(scannedAmount as string) > 0) {
        setAmount(scannedAmount as string);
      }

      if (detectedCurrency) {
        const currency = CURRENCIES.find(c => c.code === detectedCurrency);
        if (currency) {
          setSelectedCurrency(currency);
        }
      }
    }
  }, [scannedAmount, detectedCurrency, ocrConfidence]);

  useEffect(() => {
    const fetchMembers = async () => {
      try {
        const tripMembers = await getTripMembers(tripId as string);
        setMembers(tripMembers);
        if (tripMembers.length > 0) {
          // 현재 사용자를 기본 지불자로 설정
          const currentUserId = getCurrentUser()?.uid;
          const defaultPayer = currentUserId && tripMembers.find(m => m.id === currentUserId) 
            ? currentUserId 
            : tripMembers[0].id;
          setSelectedPayer(defaultPayer);
        }
      } catch (error) {
        console.error('Error fetching members:', error);
        Alert.alert('오류', '멤버 정보를 불러오지 못했습니다.');
      } finally {
        setLoading(false);
      }
    };

    if (tripId) {
      fetchMembers();
    }
  }, [tripId]);

  // Calculate split amounts whenever amount or split method changes
  useEffect(() => {
    if (!amount || members.length === 0) return;

    const totalAmount = parseFloat(amount);
    if (isNaN(totalAmount) || totalAmount <= 0) return;

    let updatedMembers = [...members];

    switch (splitMethod.id) {
      case 'equal':
        const equalAmount = totalAmount / members.length;
        updatedMembers = members.map(member => ({
          ...member,
          amount: equalAmount,
          percentage: (100 / members.length)
        }));
        break;

      case 'percentage':
        // If no percentages are set, distribute equally
        if (!members.some(m => m.percentage && m.percentage > 0)) {
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
        // Keep existing custom amounts or set to 0 if not set
        updatedMembers = members.map(member => ({
          ...member,
          amount: member.amount || 0,
          percentage: ((member.amount || 0) / totalAmount) * 100
        }));
        break;
    }

    setMembers(updatedMembers);
  }, [amount, splitMethod.id, members.length]);

  const handlePercentageChange = (memberId: string, percentage: number) => {
    if (splitMethod.id !== 'percentage') return;

    const otherMembersTotal = members.reduce((sum, m) => 
      m.id === memberId ? sum : sum + (m.percentage || 0), 0);

    if (otherMembersTotal + percentage > 100) {
      Alert.alert('오류', '비율의 합이 100%를 초과할 수 없습니다.');
      return;
    }

    const totalAmount = parseFloat(amount) || 0;
    setMembers(prev => prev.map(member => ({
      ...member,
      percentage: member.id === memberId ? percentage : member.percentage,
      amount: member.id === memberId 
        ? (totalAmount * percentage) / 100 
        : member.amount
    })));
  };

  const handleCustomAmountChange = (memberId: string, customAmount: string) => {
    if (splitMethod.id !== 'custom') return;

    const amountValue = parseFloat(customAmount) || 0;
    setMembers(prev => prev.map(member => ({
      ...member,
      amount: member.id === memberId ? amountValue : member.amount
    })));
  };

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('오류', '내용을 입력해주세요.');
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert('오류', '올바른 금액을 입력해주세요.');
      return;
    }

    if (!selectedPayer) {
      Alert.alert('오류', '지불자를 선택해주세요.');
      return;
    }

    if (!tripId) {
      Alert.alert('오류', '여행 정보가 없습니다.');
      return;
    }

    try {
      // Ensure we have a valid tripId
      const targetTripId = Array.isArray(tripId) ? tripId[0] : tripId;
      if (!targetTripId) {
        throw new Error('유효하지 않은 여행 ID입니다.');
      }

      // 분할 대상자 ID 배열 생성 (amount가 0보다 큰 멤버만)
      const splitBetween = members
        .filter(member => (member.amount || 0) > 0)
        .map(member => member.id);

      if (splitBetween.length === 0) {
        Alert.alert('오류', '최소 한 명 이상의 분할 대상자가 필요합니다.');
        return;
      }

      // 분할 정보는 별도로 저장
      const splits = members.map(member => ({
        userId: member.id,
        amount: member.amount || 0,
        percentage: member.percentage || 0
      }));

      const expenseData = {
        tripId: targetTripId,
        title: title.trim(),
        amount: parseFloat(amount),
        currency: selectedCurrency.code,
        paidBy: selectedPayer,
        splitBetween,
        category: ExpenseCategory.OTHER,
        date: new Date(),
        createdAt: new Date(),
        splits
      };

      await addExpense(expenseData);
      
      // 저장 성공 후 즉시 이동
      router.replace({
        pathname: "/trip/[id]",
        params: { 
          id: targetTripId,
          refresh: Date.now().toString() // 새로고침을 위한 타임스탬프 추가
        }
      });
    } catch (error) {
      console.error('Error saving expense:', error);
      Alert.alert('오류', '지출 저장에 실패했습니다.');
    }
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

  const renderSplitDetails = () => {
    if (!amount || members.length === 0) return null;

    const totalAmount = parseFloat(amount);

    return (
      <View style={styles.splitContainer}>
        <View style={styles.splitMethodContainer}>
          {SPLIT_METHODS.map((method) => (
            <TouchableOpacity
              key={method.id}
              style={[
                styles.splitMethodItem,
                splitMethod.id === method.id && styles.selectedSplitMethod
              ]}
              onPress={() => setSplitMethod(method)}
            >
              <Text style={[
                styles.splitMethodText,
                splitMethod.id === method.id && styles.splitMethodTextActive
              ]}>
                {method.name}
              </Text>
              <Text style={styles.splitMethodDescription}>
                {method.description}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.membersContainer}>
          {members.map((member) => (
            <View key={member.id} style={styles.memberSplitItem}>
              <View style={styles.memberInfo}>
                <View style={[styles.memberAvatar, { backgroundColor: getAvatarColor(member.id) }]}>
                  <Text style={styles.memberAvatarText}>{member.name[0]}</Text>
                </View>
                <Text style={styles.memberName}>{member.name}</Text>
              </View>

              <View style={styles.splitInputContainer}>
                {splitMethod.id === 'percentage' && (
                  <View style={styles.percentageInputContainer}>
                    <View style={styles.inputWithLabel}>
                      <TextInput
                        style={styles.splitInput}
                        value={member.percentage ? member.percentage.toString() : ''}
                        onChangeText={(text) => handlePercentageChange(member.id, parseFloat(text) || 0)}
                        keyboardType="numeric"
                        placeholder="0"
                      />
                      <Text style={styles.inputUnit}>%</Text>
                    </View>
                    <Text style={styles.calculatedAmount}>
                      {selectedCurrency.symbol}{((totalAmount * (member.percentage || 0)) / 100).toFixed(0)}
                    </Text>
                  </View>
                )}
                
                {splitMethod.id === 'custom' && (
                  <View style={styles.customInputContainer}>
                    <Text style={styles.currencySymbol}>{selectedCurrency.symbol}</Text>
                    <TextInput
                      style={styles.customSplitInput}
                      value={member.amount !== undefined ? member.amount.toString() : ''}
                      onChangeText={(text) => handleCustomAmountChange(member.id, text)}
                      keyboardType="numeric"
                      placeholder="0"
                    />
                    {(member.amount || 0) > 0 && (
                      <Text style={styles.percentageIndicator}>
                        ({(((member.amount || 0) / totalAmount) * 100).toFixed(1)}%)
                      </Text>
                    )}
                  </View>
                )}

                {splitMethod.id === 'equal' && (
                  <Text style={styles.splitAmount}>
                    {selectedCurrency.symbol}{(member.amount || 0).toFixed(0)}
                  </Text>
                )}
              </View>
            </View>
          ))}
        </View>

        <View style={styles.totalContainer}>
          <Text style={styles.totalText}>
            총 분할 금액: {selectedCurrency.symbol}{members.reduce((sum, m) => sum + (m.amount || 0), 0).toFixed(0)}
          </Text>
          {splitMethod.id === 'percentage' && (
            <Text style={styles.percentageTotal}>
              총 비율: {members.reduce((sum, m) => sum + (m.percentage || 0), 0).toFixed(1)}%
            </Text>
          )}
          {splitMethod.id === 'custom' && (
            <Text style={[
              styles.remainingAmount,
              totalAmount !== members.reduce((sum, m) => sum + (m.amount || 0), 0) && styles.remainingAmountWarning
            ]}>
              남은 금액: {selectedCurrency.symbol}
              {(totalAmount - members.reduce((sum, m) => sum + (m.amount || 0), 0)).toFixed(0)}
            </Text>
          )}
        </View>
      </View>
    );
  };

  const renderOCRStatus = () => {
    if (!ocrInfo.amount && !ocrInfo.currency) return null;

    const confidence = ocrInfo.confidence || 0;
    const isHighConfidence = confidence > 0.7;
    const isMediumConfidence = confidence > 0.4;

    return (
      <View style={styles.ocrStatusContainer}>
        <View style={styles.ocrHeader}>
          <Ionicons 
            name={isHighConfidence ? "checkmark-circle" : isMediumConfidence ? "warning" : "alert-circle"} 
            size={20} 
            color={isHighConfidence ? "#4ECDC4" : isMediumConfidence ? "#FFA726" : "#FF6B6B"} 
          />
          <Text style={styles.ocrStatusText}>OCR 인식 결과</Text>
        </View>
        
        {ocrInfo.amount && (
          <View style={styles.ocrResultRow}>
            <Text style={styles.ocrLabel}>인식된 금액:</Text>
            <Text style={styles.ocrValue}>
              {selectedCurrency.symbol}{parseFloat(ocrInfo.amount).toLocaleString()}
            </Text>
          </View>
        )}
        
        <View style={styles.ocrResultRow}>
          <Text style={styles.ocrLabel}>신뢰도:</Text>
          <Text style={[
            styles.ocrConfidence,
            { color: isHighConfidence ? "#4ECDC4" : isMediumConfidence ? "#FFA726" : "#FF6B6B" }
          ]}>
            {Math.round(confidence * 100)}%
          </Text>
        </View>

        {!isHighConfidence && (
          <Text style={styles.ocrWarning}>
            {confidence < 0.4 
              ? "인식 정확도가 낮습니다. 금액을 다시 확인해주세요."
              : "금액을 한번 더 확인해주세요."
            }
          </Text>
        )}
      </View>
    );
  };

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
          <Text style={styles.headerTitle}>정산 추가 하기</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.tripInfo}>
            <View style={styles.tripIcon}>
              <Ionicons name="airplane" size={20} color="white" />
            </View>
            <Text style={styles.tripName}>{tripName || '여행'}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>내용을 작성해주세요</Text>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>제목</Text>
              <TextInput
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                placeholder="어떤 항목인지 입력해주세요"
              />
            </View>

            <View style={styles.amountContainer}>
              <Text style={styles.label}>화폐 / 금액</Text>
              <View style={styles.amountInputContainer}>
                <TouchableOpacity 
                  style={styles.currencySelector}
                  onPress={() => setShowCurrencyModal(true)}
                >
                  <Text style={styles.currencyText}>{selectedCurrency.code}</Text>
                  <Ionicons name="chevron-down" size={16} color="#666" />
                </TouchableOpacity>
                <TextInput
                  style={styles.amountInput}
                  value={amount}
                  onChangeText={setAmount}
                  placeholder="3.00"
                  keyboardType="numeric"
                />
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>정산 방식</Text>
            <View style={styles.paidByContainer}>
              <Text style={styles.label}>누가 결제했나요?</Text>
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
                      selectedPayer === member.id && styles.selectedPayerItem
                    ]}
                    onPress={() => setSelectedPayer(member.id)}
                  >
                    <View style={[styles.memberAvatar, { backgroundColor: getAvatarColor(member.id) }]}>
                      <Text style={styles.memberAvatarText}>{member.name[0]}</Text>
                    </View>
                    <Text style={styles.payerName}>{member.name}</Text>
                    {selectedPayer === member.id && (
                      <Ionicons 
                        name="checkmark-circle" 
                        size={16} 
                        color="#4A90E2" 
                        style={styles.selectedIndicator}
                      />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {renderSplitDetails()}
          </View>

          <TouchableOpacity
            style={[styles.saveButton, loading && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={loading}
          >
            <Text style={styles.saveButtonText}>
              {loading ? '저장 중...' : '저장'}
            </Text>
          </TouchableOpacity>
        </ScrollView>

        <Modal
          animationType="slide"
          transparent={true}
          visible={showCurrencyModal}
          onRequestClose={() => setShowCurrencyModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>화폐 선택</Text>
                <TouchableOpacity onPress={() => setShowCurrencyModal(false)}>
                  <Text style={styles.modalCancelText}>취소</Text>
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
    </TabLayout>
  );
}

const styles = StyleSheet.create<Styles>({
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
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
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
  content: {
    flex: 1,
    padding: 20,
  },
  tripInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  tripIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#4A90E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  tripName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  section: {
    backgroundColor: 'white',
    padding: 20,
    marginBottom: 12,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
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
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  memberAmount: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  splitMethodsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  splitMethodButton: {
    padding: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    marginRight: 8,
    marginBottom: 8,
  },
  splitMethodButtonActive: {
    backgroundColor: '#E3F2FD',
  },
  splitMethodText: {
    fontSize: 14,
    color: '#333',
  },
  splitMethodTextActive: {
    color: '#4A90E2',
    fontWeight: '600',
  },
  amountContainer: {
    marginBottom: 16,
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  currencySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    marginRight: 8,
  },
  currencyText: {
    fontSize: 16,
    color: '#333',
  },
  amountInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  saveButton: {
    backgroundColor: '#4A90E2',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  saveButtonDisabled: {
    backgroundColor: '#E5E5E5',
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  inputContainer: {
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  flex1: {
    flex: 1,
  },
  currencyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  currencyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    padding: 12,
    borderRadius: 8,
    marginLeft: 12,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  payerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  payerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    padding: 12,
    borderRadius: 8,
    marginRight: 8,
  },
  selectedPayerItem: {
    backgroundColor: '#E3F2FD',
  },
  payerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#4A90E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  payerAvatarText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  payerName: {
    fontSize: 16,
    color: '#333',
  },
  splitContainer: {
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
  splitMethodContainer: {
    marginBottom: 20,
  },
  splitMethodItem: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  selectedSplitMethod: {
    backgroundColor: '#E3F2FD',
    borderColor: '#4A90E2',
    borderWidth: 1,
  },
  splitMethodText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  splitMethodTextActive: {
    color: '#4A90E2',
  },
  splitMethodDescription: {
    fontSize: 14,
    color: '#666',
  },
  membersContainer: {
    marginBottom: 12,
  },
  memberSplitItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  splitInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  splitInput: {
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
  totalContainer: {
    backgroundColor: 'white',
    padding: 20,
    marginBottom: 12,
  },
  totalText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    textAlign: 'right',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'white',
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalCancelText: {
    fontSize: 16,
    color: '#4A90E2',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  placeholder: {
    width: 32,
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
  selectedMemberItem: {
    backgroundColor: '#E3F2FD',
  },
  ocrStatusContainer: {
    backgroundColor: '#F0F8FF',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#4A90E2',
  },
  ocrHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  ocrStatusText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
  },
  ocrResultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  ocrLabel: {
    fontSize: 14,
    color: '#666',
  },
  ocrValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  ocrConfidence: {
    fontSize: 14,
    fontWeight: '600',
  },
  ocrWarning: {
    fontSize: 12,
    color: '#FF6B6B',
    marginTop: 8,
    fontStyle: 'italic',
  },
  ocrIndicator: {
    marginLeft: 8,
  },
  ocrFilledInput: {
    borderColor: '#4A90E2',
    backgroundColor: '#F0F8FF',
  },
  receiptImageContainer: {
    marginBottom: 16,
  },
  imageWrapper: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 8,
    alignItems: 'center',
  },
  receiptImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    resizeMode: 'contain',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  payerScrollView: {
    padding: 12,
  },
  selectedIndicator: {
    marginLeft: 8,
  },
  emptyMembersContainer: {
    padding: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyMembersText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  inputWithLabel: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputUnit: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  percentageTotal: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    marginTop: 8,
  },
  paidByContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  paidBySelector: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  paidByName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  expandButton: {
    padding: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    marginRight: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 8,
    width: '80%',
    maxHeight: '80%',
  },
  customInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flex: 1,
  },
  currencySymbol: {
    fontSize: 16,
    color: '#666',
    marginRight: 4,
  },
  customSplitInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    padding: 0,
    minWidth: 60,
  },
  percentageIndicator: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  remainingAmount: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  remainingAmountWarning: {
    color: '#FF6B6B',
    fontWeight: '500',
  },
  percentageInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flex: 1,
  },
  calculatedAmount: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
    marginLeft: 12,
  },
}); 