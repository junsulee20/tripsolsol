import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import TabLayout from '../../components/TabLayout';

const mockGroups = [
  { id: '1', name: '21학번 동기 유럽 여행', icon: 'airplane', color: '#4A90E2' },
  { id: '2', name: '오사카 커플 여행', icon: 'heart', color: '#FF6B6B' },
  { id: '3', name: '8.21-8.23 학술 컨퍼런스', icon: 'school', color: '#FFA726' },
  { id: '4', name: '베트남 다낭', icon: 'airplane', color: '#4A90E2' },
];

export default function AddExpenseScreen() {
  const handleSelectGroup = (group: any) => {
    router.push({
      pathname: '/expense/detail',
      params: { groupId: group.id, groupName: group.name }
    });
  };

  const renderGroupItem = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.groupItem}
      onPress={() => handleSelectGroup(item)}
    >
      <View style={[styles.groupIcon, { backgroundColor: item.color }]}>
        <Ionicons name={item.icon as any} size={20} color="white" />
      </View>
      <Text style={styles.groupName}>{item.name}</Text>
    </TouchableOpacity>
  );

  return (
    <TabLayout>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>지출 추가할 그룹 선택</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.content}>
        <View style={styles.instructionContainer}>
          <Text style={styles.instructionText}>
            지출을 추가할 그룹을 선택해주세요
          </Text>
        </View>

        <FlatList
          data={mockGroups}
          renderItem={renderGroupItem}
          keyExtractor={item => item.id}
          style={styles.groupsList}
        />
      </View>
    </TabLayout>
  );
}

const styles = StyleSheet.create({
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
    padding: 20,
  },
  instructionContainer: {
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
    padding: 16,
    marginBottom: 24,
  },
  instructionText: {
    fontSize: 16,
    color: '#1976D2',
    textAlign: 'center',
    fontWeight: '500',
  },
  groupsList: {
    flex: 1,
  },
  groupItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  groupIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  groupName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    flex: 1,
  },
}); 