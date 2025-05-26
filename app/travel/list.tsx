import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const mockTravels = [
  {
    id: '1',
    country: '중국여행',
    flag: '🇨🇳',
    amount: '1,300,000원',
    date: 'April.19 12:31',
    status: 'received'
  },
  {
    id: '2',
    country: '일본여행',
    flag: '🇯🇵',
    amount: '200,000원',
    date: 'April.19 15:20',
    status: 'paid'
  },
  {
    id: '3',
    country: '미국여행',
    flag: '🇺🇸',
    amount: '2,000,000원',
    date: 'April.19 19:07',
    status: 'received'
  },
  {
    id: '4',
    country: '태국여행',
    flag: '🇹🇭',
    amount: '정산완료',
    date: 'April.20 06:15',
    status: 'completed'
  },
  {
    id: '5',
    country: '제주도여행',
    flag: '✈️',
    amount: '1,400원',
    date: 'April.22 11:10',
    status: 'received'
  }
];

export default function TravelListScreen() {
  const [user] = useState({ name: '빅토리아', avatar: '빅' });

  const handleAddTravel = () => {
    router.push('/trip/create');
  };

  const handleTravelPress = (travel: any) => {
    router.push(`/trip/${travel.id}`);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'received':
        return '#4A90E2';
      case 'paid':
        return '#FF6B6B';
      case 'completed':
        return '#4CAF50';
      default:
        return '#666';
    }
  };

  const renderTravelItem = (travel: any) => (
    <TouchableOpacity
      key={travel.id}
      style={styles.travelItem}
      onPress={() => handleTravelPress(travel)}
    >
      <View style={styles.travelInfo}>
        <Text style={styles.travelFlag}>{travel.flag}</Text>
        <View style={styles.travelDetails}>
          <Text style={styles.travelCountry}>{travel.country}</Text>
          <Text style={styles.travelDate}>{travel.date}</Text>
        </View>
      </View>
      <Text style={[styles.travelAmount, { color: getStatusColor(travel.status) }]}>
        {travel.status === 'received' ? '받을돈 : ' : travel.status === 'paid' ? '줄 돈 : ' : ''}
        {travel.amount}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.userInfo}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user.avatar}</Text>
          </View>
          <Text style={styles.userName}>{user.name}</Text>
          <Text style={styles.subtitle}>정산할 여행을 선택해주세요!</Text>
        </View>
        <TouchableOpacity style={styles.timerButton}>
          <Ionicons name="time" size={20} color="#4A90E2" />
        </TouchableOpacity>
      </View>

      <View style={styles.progressBar}>
        <View style={styles.progressFill} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>여행</Text>
          <View style={styles.travelsList}>
            {mockTravels.map(renderTravelItem)}
          </View>
          
          <TouchableOpacity style={styles.addTravelButton} onPress={handleAddTravel}>
            <Text style={styles.addTravelText}>새로운 여행 추가하기</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
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
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FF6B6B',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginRight: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
  },
  timerButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressBar: {
    height: 4,
    backgroundColor: '#E5E5E5',
  },
  progressFill: {
    height: '100%',
    width: '60%',
    backgroundColor: '#4A90E2',
  },
  content: {
    flex: 1,
  },
  section: {
    backgroundColor: '#E3F2FD',
    margin: 16,
    borderRadius: 12,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1976D2',
    marginBottom: 16,
  },
  travelsList: {
    marginBottom: 20,
  },
  travelItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  travelInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  travelFlag: {
    fontSize: 24,
    marginRight: 12,
  },
  travelDetails: {
    flex: 1,
  },
  travelCountry: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  travelDate: {
    fontSize: 12,
    color: '#666',
  },
  travelAmount: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'right',
  },
  addTravelButton: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1976D2',
    borderStyle: 'dashed',
  },
  addTravelText: {
    fontSize: 16,
    color: '#1976D2',
    fontWeight: '500',
  },
}); 