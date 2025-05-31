import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getUserTrips } from '../../services/firebaseService';
import { Trip } from '../../types';

export default function AddExpenseScreen() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTrips = async () => {
      try {
        const userId = 'test-user-id'; // TODO: Get actual user ID from auth context
        const tripsFromDB = await getUserTrips(userId);
        setTrips(tripsFromDB);
      } catch (error) {
        console.error('Error fetching trips:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTrips();
  }, []);

  const handleSelectTrip = (trip: Trip) => {
    router.push({
      pathname: '/expense/camera',
      params: { tripId: trip.id, tripName: trip.name }
    });
  };

  const renderTripItem = ({ item }: { item: Trip }) => (
    <TouchableOpacity
      style={styles.tripItem}
      onPress={() => handleSelectTrip(item)}
    >
      <View style={[styles.tripIcon, { backgroundColor: '#4A90E2' }]}>
        <Ionicons name="airplane" size={20} color="white" />
      </View>
      <View style={styles.tripInfo}>
        <Text style={styles.tripName}>{item.name}</Text>
        <Text style={styles.tripSubtitle}>
          {item.startDate?.toLocaleDateString?.() || ''}
          {item.endDate ? ` ~ ${item.endDate.toLocaleDateString?.()}` : ''}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#666" />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>지출 추가할 여행 선택</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.content}>
        <View style={styles.instructionContainer}>
          <Text style={styles.instructionText}>
            지출을 추가할 여행을 선택해주세요
          </Text>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#4A90E2" />
          </View>
        ) : trips.length > 0 ? (
          <FlatList
            data={trips}
            renderItem={renderTripItem}
            keyExtractor={item => item.id}
            style={styles.tripsList}
          />
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>여행이 없습니다</Text>
            <TouchableOpacity 
              style={styles.createTripButton}
              onPress={() => router.push('/trip/create')}
            >
              <Text style={styles.createTripButtonText}>새 여행 만들기</Text>
            </TouchableOpacity>
          </View>
        )}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 16,
  },
  createTripButton: {
    backgroundColor: '#4A90E2',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  createTripButtonText: {
    color: 'white',
    fontSize: 16,
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
  tripInfo: {
    flex: 1,
  },
  tripName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  tripSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  percentageInput: {
    // Add appropriate styles for percentage input
  },
  amountInput: {
    // Add appropriate styles for amount input
  },
}); 