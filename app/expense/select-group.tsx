import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Alert
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { auth } from '../../config/firebase';
import { getUserTrips } from '../../services/firebaseService';
import { Trip } from '../../types';

const mockTrips = [
  { id: '1', name: '21학번 동기 유럽 여행', icon: 'airplane', color: '#4A90E2' },
  { id: '2', name: '오사카 커플 여행', icon: 'heart', color: '#FF6B6B' },
  { id: '3', name: '8.21-8.23 학술 컨퍼런스', icon: 'school', color: '#FFA726' },
  { id: '4', name: '베트남 다낭', icon: 'airplane', color: '#4A90E2' },
];

export default function SelectGroupScreen() {
  const [trips, setTrips] = useState<any[]>(mockTrips);
  const [loading, setLoading] = useState(false);

  const handleSelectTrip = (trip: any) => {
    // 선택된 그룹 정보를 다음 화면으로 전달
    router.push({
      pathname: '/expense/detail',
      params: { tripId: trip.id, tripName: trip.name }
    });
  };

  const renderTripItem = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.tripItem}
      onPress={() => handleSelectTrip(item)}
    >
      <View style={[styles.tripIcon, { backgroundColor: item.color }]}>
        <Ionicons name={item.icon as any} size={20} color="white" />
      </View>
      <Text style={styles.tripName}>{item.name}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>정산 추가 하기</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.content}>
        <View style={styles.instructionContainer}>
          <Text style={styles.instructionText}>그룹을 선택해주세요</Text>
        </View>

        <FlatList
          data={trips}
          renderItem={renderTripItem}
          keyExtractor={(item) => item.id}
          style={styles.tripsList}
          showsVerticalScrollIndicator={false}
        />
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
  tripsList: {
    flex: 1,
  },
  tripItem: {
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
  tripIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  tripName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    flex: 1,
  },
}); 