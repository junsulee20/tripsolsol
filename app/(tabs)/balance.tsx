import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import BalanceScreen from '../balance/index';
import { router } from 'expo-router';

export default function BalanceTabScreen() {
  useEffect(() => {
    // 탭이 로드되면 즉시 profile/settings 페이지로 리다이렉트
    router.replace('/profile/settings');
  }, []);

  return null; // 리다이렉트되므로 렌더링할 내용 없음
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
}); 