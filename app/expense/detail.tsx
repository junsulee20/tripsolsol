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
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getTripMembers, getCurrentUser, onAuthStateChange, addExpense } from '../../services/firebaseService';

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
          percentage: (equalAmount / totalAmount) * 100
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
          amount: member.amount || 0
        }));
        break;
    }

    // Only update if there's actually a change to prevent infinite loops
    const hasChanges = updatedMembers.some((member, index) => 
      Math.abs((member.amount || 0) - (members[index].amount || 0)) > 0.01
    );

    if (hasChanges) {
      setMembers(updatedMembers);
    }
  }, [amount, splitMethod.id]);

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

    try {
      // 분할 대상자 ID 배열 생성
      const splitBetween = members
        .filter(member => (member.amount || 0) > 0)
        .map(member => member.id);

      const expenseData = {
        tripId: tripId as string,
        title: title.trim(),
        amount: parseFloat(amount),
        currency: selectedCurrency.code,
        paidBy: selectedPayer,
        splitBetween,
        category: 'other' as any, // TODO: 카테고리 선택 기능 추가
        date: new Date(),
        createdAt: new Date(),
      };

      await addExpense(expenseData);
      
      Alert.alert('성공', '지출이 추가되었습니다.', [
        { text: '확인', onPress: () => router.back() }
      ]);
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
      <View style={styles.splitContainer}>
        <Text style={styles.sectionTitle}>분할 내역</Text>
        
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
                splitMethod.id === method.id && styles.selectedSplitMethodText
              ]}>
                {method.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.membersContainer}>
          {members.map((member) => (
            <View key={member.id} style={styles.memberSplitItem}>
              <View style={styles.memberInfo}>
                <View style={styles.memberAvatar}>
                  <Text style={styles.memberAvatarText}>{member.name[0]}</Text>
                </View>
                <Text style={styles.memberName}>{member.name}</Text>
              </View>

              <View style={styles.splitInputContainer}>
                {splitMethod.id === 'percentage' && (
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
                )}
                
                {splitMethod.id === 'custom' && (
                  <TextInput
                    style={styles.splitInput}
                    value={member.amount ? member.amount.toString() : ''}
                    onChangeText={(text) => handleCustomAmountChange(member.id, text)}
                    keyboardType="numeric"
                    placeholder="0"
                  />
                )}

                <Text style={styles.splitAmount}>
                  {selectedCurrency.symbol}{(member.amount || 0).toFixed(0)}
                </Text>
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
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* 공통 네비게이션 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>지출 상세 입력</Text>
        <TouchableOpacity onPress={handleSave} style={styles.saveButton}>
          <Text style={styles.saveButtonText}>저장</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.form}>
          {/* OCR 상태 표시 */}
          {renderOCRStatus()}

          {/* 영수증 이미지 표시 */}
          {receiptImage && (
            <View style={styles.receiptImageContainer}>
              <Text style={styles.label}>촬영한 영수증</Text>
              <View style={styles.imageWrapper}>
                <Image source={{ uri: receiptImage as string }} style={styles.receiptImage} />
              </View>
            </View>
          )}

          <View style={styles.inputContainer}>
            <Text style={styles.label}>제목 *</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="예: 점심식사"
              maxLength={50}
            />
          </View>

          <View style={styles.row}>
            <View style={[styles.inputContainer, styles.flex1]}>
              <Text style={styles.label}>
                금액 *
                {ocrInfo.amount && (
                  <Text style={styles.ocrIndicator}> (OCR 인식)</Text>
                )}
              </Text>
              <TextInput
                style={[
                  styles.input,
                  ocrInfo.amount && styles.ocrFilledInput
                ]}
                value={amount}
                onChangeText={setAmount}
                placeholder="0"
                keyboardType="numeric"
              />
            </View>

            <View style={styles.currencyContainer}>
              <Text style={styles.label}>
                통화
                {ocrInfo.currency && (
                  <Text style={styles.ocrIndicator}> (인식됨)</Text>
                )}
              </Text>
              <TouchableOpacity
                style={[
                  styles.currencyButton,
                  ocrInfo.currency && styles.ocrFilledInput
                ]}
                onPress={() => setShowCurrencyModal(true)}
              >
                <Text style={styles.currencyText}>{selectedCurrency.code}</Text>
                <Ionicons name="chevron-down" size={16} color="#666" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>지불자</Text>
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="#4A90E2" />
                <Text style={styles.loadingText}>멤버 정보를 불러오는 중...</Text>
              </View>
            ) : members.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.payerScrollView}>
                <View style={styles.payerContainer}>
                  {members.map((member) => (
                    <TouchableOpacity
                      key={member.id}
                      style={[
                        styles.payerItem,
                        selectedPayer === member.id && styles.selectedPayerItem
                      ]}
                      onPress={() => setSelectedPayer(member.id)}
                    >
                      <View style={styles.payerAvatar}>
                        <Text style={styles.payerAvatarText}>{member.name[0]}</Text>
                      </View>
                      <Text style={styles.payerName}>{member.name}</Text>
                      {selectedPayer === member.id && (
                        <View style={styles.selectedIndicator}>
                          <Ionicons name="checkmark-circle" size={16} color="#4A90E2" />
                        </View>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            ) : (
              <View style={styles.emptyMembersContainer}>
                <Text style={styles.emptyMembersText}>멤버 정보를 불러올 수 없습니다</Text>
              </View>
            )}
          </View>

          {renderSplitDetails()}
        </View>
      </ScrollView>

      {/* Currency Modal */}
      <Modal
        visible={showCurrencyModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowCurrencyModal(false)}>
              <Text style={styles.modalCancelText}>취소</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>통화 선택</Text>
            <View style={styles.placeholder} />
          </View>
          <FlatList
            data={CURRENCIES}
            renderItem={renderCurrencyItem}
            keyExtractor={item => item.code}
          />
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
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#4A90E2',
    borderRadius: 8,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
  content: {
    flex: 1,
  },
  form: {
    padding: 20,
  },
  inputContainer: {
    marginBottom: 12,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
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
  currencyText: {
    fontSize: 16,
    marginRight: 8,
  },
  payerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  payerItem: {
    padding: 12,
    backgroundColor: '#F8F9FA',
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
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  splitMethodItem: {
    padding: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    marginRight: 8,
  },
  selectedSplitMethod: {
    backgroundColor: '#E3F2FD',
  },
  splitMethodText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  selectedSplitMethodText: {
    fontWeight: '600',
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
    marginBottom: 20,
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: '500',
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
    fontSize: 12,
    color: '#4A90E2',
    fontWeight: 'normal',
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
}); 