import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { useColorScheme } from '@hooks/useColorScheme';
import { AuthProvider } from '@hooks/useAuth';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  if (!loaded) {
    return null;
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AuthProvider>
        <Stack>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="auth/login" options={{ headerShown: false }} />
          <Stack.Screen name="auth/signup" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="trip/create" options={{ headerShown: false }} />
          <Stack.Screen name="trip/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="expense/add" options={{ headerShown: false, presentation: 'modal' }} />
          <Stack.Screen name="expense/detail" options={{ headerShown: false }} />
          <Stack.Screen name="travel/list" options={{ headerShown: false }} />
          <Stack.Screen name="expense/camera" options={{ headerShown: false }} />
          <Stack.Screen name="expense/simple" options={{ headerShown: false }} />
          <Stack.Screen name="profile/edit" options={{ headerShown: false }} />
          <Stack.Screen name="profile/settings" options={{ headerShown: false, presentation: 'modal' }} />
          <Stack.Screen name="qr/scan" options={{ headerShown: false }} />
          <Stack.Screen name="qr/generate" options={{ headerShown: false }} />
          <Stack.Screen name="balance/index" options={{ headerShown: false }} />
          <Stack.Screen name="+not-found" />
        </Stack>
        <StatusBar style="auto" />
      </AuthProvider>
    </ThemeProvider>
  );
}
