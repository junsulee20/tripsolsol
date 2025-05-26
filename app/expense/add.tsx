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

const categories = [
  { id: 'travel', name: '여행', icon: 'airplane', color: '#4A90E2' },
  { id: 'food', name: '음식', icon: 'restaurant', color: '#FF6B6B' },
  { id: 'coffee', name: '커피', icon: 'cafe', color: '#8B4513' },
  { id: 'custom', name: '커스텀', icon: 'settings', color: '#95A5A6' },
];

const members = [
  { id: '1', name: '나 (김윤정)', avatar: '김' },
];

export default function AddExpenseScreen() {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('travel');
  const [selectedMembers, setSelectedMembers] = useState(['1']);
  const [loading, setLoading] = useState(false);

  const handleAddMember = () => {
    Alert.alert('구성원 추가', '새로운 구성원을 추가하시겠습니까?');
  };

  const handleSave = async () => {
    if (!description.trim()) {
      Alert.alert('오류', '그룹 이름을 입력해주세요.');
      return;
    }

    // 그룹 선택 화면으로 이동
    router.push('/expense/select-group');
  };

  const renderCategoryItem = (category: any) => (
    <TouchableOpacity
      key={category.id}
      style={[
        styles.categoryItem,
        selectedCategory === category.id && styles.categoryItemSelected
      ]}
      onPress={() => setSelectedCategory(category.id)}
    >
      <View style={[styles.categoryIcon, { backgroundColor: category.color }]}>
        <Ionicons name={category.icon as any} size={20} color="white" />
      </View>
      <Text style={styles.categoryName}>{category.name}</Text>
    </TouchableOpacity>
  );

  const renderMemberItem = (member: any) => (
    <View key={member.id} style={styles.memberItem}>
      <View style={styles.memberInfo}>
        <View style={styles.memberAvatar}>
          <Text style={styles.memberAvatarText}>{member.avatar}</Text>
        </View>
        <Text style={styles.memberName}>{member.name}</Text>
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>새 그룹 만들기</Text>
        <TouchableOpacity 
          style={styles.simpleButton}
          onPress={() => router.push('/expense/simple')}
        >
          <Text style={styles.simpleButtonText}>간단히</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.form}>
          <View style={styles.inputContainer}>
            <Text style={styles.label}>그룹 이름</Text>
            <TextInput
              style={styles.input}
              value={description}
              onChangeText={setDescription}
              placeholder="예: 서울 여행, 가족 식비, 홈파티 모임"
              maxLength={100}
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>그룹 타입 선택</Text>
            <View style={styles.categoriesContainer}>
              {categories.map(renderCategoryItem)}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>구성원</Text>
            <View style={styles.membersContainer}>
              {members.map(renderMemberItem)}
              <TouchableOpacity style={styles.addMemberButton} onPress={handleAddMember}>
                <Ionicons name="add" size={20} color="#4A90E2" />
                <Text style={styles.addMemberText}>구성원 추가</Text>
              </TouchableOpacity>
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
        </View>
      </ScrollView>
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
  simpleButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#E3F2FD',
    borderRadius: 16,
  },
  simpleButtonText: {
    fontSize: 14,
    color: '#4A90E2',
    fontWeight: '500',
  },
  content: {
    flex: 1,
  },
  form: {
    padding: 20,
  },
  inputContainer: {
    marginBottom: 32,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    backgroundColor: 'white',
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  categoriesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  categoryItem: {
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: 'transparent',
    minWidth: 80,
  },
  categoryItemSelected: {
    borderColor: '#4A90E2',
  },
  categoryIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryName: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  membersContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
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
    backgroundColor: '#4A90E2',
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
  addMemberButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    marginTop: 8,
  },
  addMemberText: {
    fontSize: 16,
    color: '#4A90E2',
    fontWeight: '500',
    marginLeft: 8,
  },
  saveButton: {
    backgroundColor: '#4A90E2',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 32,
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