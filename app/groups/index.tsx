import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const mockGroups = [
  { id: '1', name: '21학번 동기 유럽 여행', icon: 'airplane', color: '#4A90E2' },
  { id: '2', name: '오사카 커플 여행', icon: 'heart', color: '#FF6B6B' },
  { id: '3', name: '8.21-8.23 학술 컨퍼런스', icon: 'school', color: '#FFA726' },
  { id: '4', name: '베트남 다낭', icon: 'airplane', color: '#4A90E2' },
];

export default function GroupsScreen() {
  const handleCreateGroup = () => {
    router.push('/groups/create');
  };

  const handleSelectGroup = (group: any) => {
    router.push({
      pathname: '/groups/[id]',
      params: { id: group.id }
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
      <View style={styles.groupInfo}>
        <Text style={styles.groupName}>{item.name}</Text>
        <Text style={styles.groupSubtitle}>4명의 멤버</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#666" />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>내 그룹</Text>
        <TouchableOpacity 
          style={styles.addButton}
          onPress={handleCreateGroup}
        >
          <Ionicons name="add" size={24} color="#4A90E2" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={mockGroups}
        renderItem={renderGroupItem}
        keyExtractor={item => item.id}
        style={styles.groupsList}
        contentContainerStyle={styles.groupsListContent}
      />
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
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  addButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  groupsList: {
    flex: 1,
  },
  groupsListContent: {
    padding: 16,
  },
  groupItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 16,
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
  groupInfo: {
    flex: 1,
  },
  groupName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  groupSubtitle: {
    fontSize: 14,
    color: '#666',
  },
}); 