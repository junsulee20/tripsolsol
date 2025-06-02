import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import TabLayout from '../../components/TabLayout';

const members = [
  { id: '1', name: '김윤정', avatar: '김', amount: 0, percentage: 25 },
  { id: '2', name: 'Junsu', avatar: 'J', amount: 0, percentage: 25 },
  { id: '3', name: 'ВИКАЭМ', avatar: 'В', amount: 0, percentage: 25 },
  { id: '4', name: '지한', avatar: '지', amount: 0, percentage: 25 },
];

const splitMethods = [
  { id: 'equal', name: '균일하게', description: '모든 사람이 동일한 금액' },
  { id: 'unequal', name: '비율대로', description: '각자 설정' },
  { id: 'custom', name: '직접 설정', description: '원하는 대로' },
];

export default function ExpenseDetailScreen() {
  const [paidBy, setPaidBy] = useState('김윤정');
  const [splitMethod, setSplitMethod] = useState('equal');
  const [totalAmount, setTotalAmount] = useState('1.00');
  const [currency, setCurrency] = useState('US$');
  const [description, setDescription] = useState('');
  const [memo, setMemo] = useState('');
  const [memberAmounts, setMemberAmounts] = useState(members);
  const [loading, setLoading] = useState(false);

  const handleSplitMethodChange = (method: string) => {
    setSplitMethod(method);
    if (method === 'equal') {
      const amount = parseFloat(totalAmount) / memberAmounts.length;
      setMemberAmounts(memberAmounts.map(member => ({
        ...member,
        amount: amount,
        percentage: 25
      })));
    }
  };

  const handleMemberAmountChange = (memberId: string, amount: string) => {
    const numAmount = parseFloat(amount) || 0;
    setMemberAmounts(memberAmounts.map(member => 
      member.id === memberId 
        ? { ...member, amount: numAmount }
        : member
    ));
  };

  const handleMemberPercentageChange = (memberId: string, percentage: number) => {
    const totalAmountNum = parseFloat(totalAmount) || 0;
    const amount = (totalAmountNum * percentage) / 100;
    setMemberAmounts(memberAmounts.map(member => 
      member.id === memberId 
        ? { ...member, percentage, amount }
        : member
    ));
  };

  const handleSave = async () => {
    if (!description.trim()) {
      Alert.alert('오류', '내용을 입력해주세요.');
      return;
    }

    if (!totalAmount || parseFloat(totalAmount) <= 0) {
      Alert.alert('오류', '올바른 금액을 입력해주세요.');
      return;
    }

    setLoading(true);
    try {
      // TODO: Firebase에 정산 저장
      Alert.alert('성공', '정산이 추가되었습니다!', [
        { text: '확인', onPress: () => router.back() }
      ]);
    } catch (error: any) {
      Alert.alert('오류', '정산 추가에 실패했습니다: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const getAvatarColor = (name: string) => {
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4'];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

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

  const renderMemberItem = (member: any) => (
    <View key={member.id} style={styles.memberItem}>
      <View style={styles.memberInfo}>
        <View style={[styles.memberAvatar, { backgroundColor: getAvatarColor(member.name) }]}>
          <Text style={styles.memberAvatarText}>{member.avatar}</Text>
        </View>
        <Text style={styles.memberName}>{member.name}</Text>
      </View>
      
      {splitMethod === 'custom' && (
        <View style={styles.memberAmountContainer}>
          <TouchableOpacity style={styles.editButton}>
            <Ionicons name="create-outline" size={16} color="#4A90E2" />
          </TouchableOpacity>
          <Text style={styles.memberAmount}>
            ${member.amount.toFixed(2)}
          </Text>
        </View>
      )}
      
      {splitMethod === 'unequal' && (
        <View style={styles.memberPercentageContainer}>
          <Text style={styles.memberPercentage}>{member.percentage}%</Text>
          <Text style={styles.memberAmount}>
            ${member.amount.toFixed(1)}
          </Text>
        </View>
      )}
      
      {splitMethod === 'equal' && (
        <Text style={styles.memberAmount}>
          ${member.amount.toFixed(2)}
        </Text>
      )}
    </View>
  );

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
            <Text style={styles.tripName}>21학번 동기 유럽 여행</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>정산 방식을 선택해주세요</Text>
            <View style={styles.paidByContainer}>
              <Text style={styles.label}>누가 결제했나요?</Text>
              <View style={styles.paidBySelector}>
                <View style={[styles.memberAvatar, { backgroundColor: getAvatarColor(paidBy) }]}>
                  <Text style={styles.memberAvatarText}>김</Text>
                </View>
                <Text style={styles.paidByName}>{paidBy}</Text>
              </View>
            </View>

            <Text style={styles.label}>어떻게 정산하고 싶으신가요?</Text>
            <View style={styles.splitMethodsContainer}>
              {splitMethods.map(renderSplitMethodItem)}
            </View>

            {splitMethod === 'custom' && (
              <View style={styles.membersContainer}>
                <TouchableOpacity style={styles.expandButton}>
                  <Ionicons name="chevron-down" size={20} color="#4A90E2" />
                </TouchableOpacity>
                {memberAmounts.map(renderMemberItem)}
              </View>
            )}

            {splitMethod === 'unequal' && (
              <View style={styles.membersContainer}>
                {memberAmounts.map(renderMemberItem)}
              </View>
            )}

            {splitMethod === 'equal' && (
              <View style={styles.membersContainer}>
                {memberAmounts.map(renderMemberItem)}
              </View>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>내용을 작성해주세요</Text>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>제목</Text>
              <TextInput
                style={styles.input}
                value={description}
                onChangeText={setDescription}
                placeholder="어떤 항목인지 입력해주세요"
              />
            </View>

            <View style={styles.amountContainer}>
              <Text style={styles.label}>화폐 / 금액</Text>
              <View style={styles.amountInputContainer}>
                <View style={styles.currencySelector}>
                  <Text style={styles.currencyText}>{currency}</Text>
                </View>
                <TextInput
                  style={styles.amountInput}
                  value={totalAmount}
                  onChangeText={setTotalAmount}
                  placeholder="3.00"
                  keyboardType="numeric"
                />
              </View>
            </View>
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
      </KeyboardAvoidingView>
    </TabLayout>
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
  tripInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'white',
    marginBottom: 20,
  },
  tripIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#4A90E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  tripName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  section: {
    backgroundColor: 'white',
    padding: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 20,
  },
  paidByContainer: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 12,
  },
  paidBySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  paidByName: {
    fontSize: 16,
    color: '#333',
    marginLeft: 12,
  },
  splitMethodsContainer: {
    marginBottom: 20,
  },
  splitMethodItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  splitMethodItemSelected: {
    backgroundColor: '#E3F2FD',
    borderColor: '#4A90E2',
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#E5E5E5',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
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
    fontWeight: '500',
    color: '#333',
    marginBottom: 2,
  },
  splitMethodDescription: {
    fontSize: 14,
    color: '#666',
  },
  membersContainer: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 16,
  },
  expandButton: {
    alignSelf: 'center',
    marginBottom: 12,
  },
  memberItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  memberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  memberAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  memberAvatarText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  memberName: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  memberAmountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  editButton: {
    padding: 4,
    marginRight: 8,
  },
  memberAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  memberPercentageContainer: {
    alignItems: 'flex-end',
  },
  memberPercentage: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  inputContainer: {
    marginBottom: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    backgroundColor: 'white',
  },
  amountContainer: {
    marginBottom: 20,
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  currencySelector: {
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginRight: 12,
  },
  currencyText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  amountInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    backgroundColor: 'white',
  },
  saveButton: {
    backgroundColor: '#4A90E2',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    margin: 20,
  },
  saveButtonDisabled: {
    backgroundColor: '#BDC3C7',
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
}); 