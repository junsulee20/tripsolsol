import { router } from 'expo-router';
import { User as FirebaseUser } from 'firebase/auth';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { onAuthStateChange } from '../services/firebaseService';
import { fonts } from '../styles/globalStyles';

export default function IndexScreen() {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    console.log('IndexScreen: Initializing authentication check...');

    const unsubscribe = onAuthStateChange((user: FirebaseUser | null) => {
      console.log('IndexScreen: Auth state changed. User:', user ? user.uid : 'null');
      if (user) {
        console.log('IndexScreen: User is authenticated. Redirecting to travel tabs.');
        router.replace('/(tabs)/travel');
      } else {
        console.log('IndexScreen: User is not authenticated. Redirecting to login.');
        router.replace('/auth/login');
      }
      setIsLoading(false);
    });

    const authTimeout = setTimeout(() => {
      if (isLoading) {
        console.warn('IndexScreen: Auth state determination timed out. Redirecting to login as a fallback.');
        router.replace('/auth/login');
        setIsLoading(false);
      }
    }, 5000);

    return () => {
      console.log('IndexScreen: Cleaning up auth listener and timeout.');
      unsubscribe();
      clearTimeout(authTimeout);
    };
  }, []);

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#4A90E2" />
        <Text style={[styles.loadingText, {fontFamily: fonts.regular}]}>앱을 시작하는 중...</Text>
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
    backgroundColor: '#F8F9FA',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
}); 