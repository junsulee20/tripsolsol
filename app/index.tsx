import { router } from 'expo-router';
import { User as FirebaseUser } from 'firebase/auth';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { getCurrentUser, onAuthStateChange } from '../services/firebaseService';

export default function IndexScreen() {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    console.log('IndexScreen: Starting authentication check...');
    
    // 현재 사용자 상태를 즉시 확인
    const currentUser = getCurrentUser();
    if (currentUser) {
      console.log('IndexScreen: User already authenticated, redirecting to travel');
      router.replace('/(tabs)/travel');
      return;
    }

    // 인증 상태 변화 감지
    const unsubscribe = onAuthStateChange((user: FirebaseUser | null) => {
      console.log('IndexScreen: Auth state changed', user ? 'Authenticated' : 'Not authenticated');
      
      if (user) {
        console.log('IndexScreen: User authenticated, redirecting to travel');
        router.replace('/(tabs)/travel');
      } else {
        console.log('IndexScreen: No user, redirecting to login');
        router.replace('/auth/login');
      }
      
      setIsLoading(false);
    });

    // 일정 시간 후에도 인증 상태가 결정되지 않으면 로그인으로 이동
    const timeout = setTimeout(() => {
      if (isLoading) {
        console.log('IndexScreen: Timeout reached, redirecting to login');
        router.replace('/auth/login');
        setIsLoading(false);
      }
    }, 3000);

    return () => {
      unsubscribe();
      clearTimeout(timeout);
    };
  }, [isLoading]);

  // 로딩 화면 표시
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#4A90E2" />
      <Text style={styles.loadingText}>앱을 시작하는 중...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
}); 