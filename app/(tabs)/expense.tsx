import React, { useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { ActivityIndicator, View, StyleSheet, Text, Alert } from 'react-native';
import { getUserTrips, onAuthStateChange } from '../../services/firebaseService';
import { Trip } from '../../types';
import { User as FirebaseUser } from 'firebase/auth';

export default function ExpenseTabScreen() {
  const [isLoading, setIsLoading] = useState(true);

  useFocusEffect(
    React.useCallback(() => {
      setIsLoading(true);

      const unsubscribe = onAuthStateChange(async (user: FirebaseUser | null) => {
        if (user) {
          try {
            const userTrips = await getUserTrips(user.uid);
            if (userTrips && userTrips.length > 0) {
              const sortedTrips = [...userTrips].sort((a, b) => {
                const getTimeSafe = (dateVal: any): number => {
                  if (!dateVal) return 0;
                  if (dateVal.toDate) return dateVal.toDate().getTime(); // Firestore Timestamp
                  if (dateVal instanceof Date) return dateVal.getTime();
                  const parsed = new Date(dateVal).getTime();
                  return isNaN(parsed) ? 0 : parsed;
                };
                return getTimeSafe(b.createdAt) - getTimeSafe(a.createdAt);
              });
              const mostRecentTrip = sortedTrips[0];
              router.replace({
                pathname: '/expense/detail',
                params: { tripId: mostRecentTrip.id, tripName: mostRecentTrip.name },
              });
            } else {
              // No trips found for the authenticated user
              Alert.alert("알림", "지출을 추가할 여행이 없습니다. 먼저 여행을 만들어주세요.");
              router.replace('/trip/create');
            }
          } catch (error) {
            console.error("Error fetching trips or navigating:", error);
            Alert.alert("오류", "최근 여행 정보를 가져오는데 실패했습니다. 여행 생성 화면으로 이동합니다.");
            router.replace('/trip/create'); // Fallback to create trip screen for logged-in user on error
          }
        } else {
          // No user is signed in
          Alert.alert("알림", "로그인이 필요합니다.");
          router.replace('/auth/login');
        }
        // setIsLoading(false); // Navigation replaces screen, so loading state of this screen is less critical after redirect
      });

      return () => {
        unsubscribe();
        setIsLoading(false); 
      };
    }, [])
  );

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#4A90E2" />
        <Text style={styles.loadingText}>지출 정보 로딩 중...</Text>
      </View>
    );
  }

  return null; 
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#333',
  },
}); 