import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import BalanceScreen from '../balance/index';
import { router } from 'expo-router';
import { fonts } from '../../styles/globalStyles';

export default function BalanceTabScreen() {
  useEffect(() => {
    // 탭이 로드되면 즉시 profile/settings 페이지로 리다이렉트
    router.replace('/profile/settings');
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>정산 화면</Text>
      <Text style={styles.subtitle}>여행 정산을 확인하세요!</Text>
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
  title: {
    fontSize: 24,
    fontWeight: '600',
    fontFamily: fonts.semiBold,
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: fonts.regular,
    color: '#666',
  },
}); 