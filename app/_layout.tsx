import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useColorScheme } from '@/hooks/useColorScheme';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    'Pretendard-Regular': require('../assets/fonts/Pretendard-Regular.ttf'),
    'Pretendard-Medium': require('../assets/fonts/Pretendard-Medium.ttf'),
    'Pretendard-SemiBold': require('../assets/fonts/Pretendard-SemiBold.ttf'),
    'Pretendard-Bold': require('../assets/fonts/Pretendard-Bold.ttf'),
    'Pretendard': require('../assets/fonts/Pretendard-Regular.ttf'), // 기본 Pretendard
  });

  if (!loaded) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="auth/login" />
          <Stack.Screen name="auth/signup" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="trip/create" />
          <Stack.Screen name="trip/[id]" />
          <Stack.Screen name="trip/edit" />
          <Stack.Screen name="expense/add" options={{ presentation: 'modal' }} />
          <Stack.Screen name="expense/detail" />
          <Stack.Screen name="expense/edit" />
          <Stack.Screen name="travel/list" />
          <Stack.Screen name="expense/camera" />
          <Stack.Screen name="profile/edit" />
          <Stack.Screen name="profile/settings" options={{ presentation: 'modal' }} />
          <Stack.Screen name="qr/scan" />
          <Stack.Screen name="qr/generate" />
          <Stack.Screen name="balance/index" />
          <Stack.Screen name="profile/settlements" />
          <Stack.Screen name="+not-found" />
        </Stack>
        <StatusBar style="dark" backgroundColor="transparent" translucent={Platform.OS === 'android'} />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
