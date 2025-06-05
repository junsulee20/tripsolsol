import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import TabBar from './TabBar';
import { fonts } from '../styles/globalStyles';

interface TabLayoutProps {
  children: React.ReactNode;
  showTabBar?: boolean;
}

export default function TabLayout({ children, showTabBar = true }: TabLayoutProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[
      styles.container,
      {
        paddingTop: Platform.OS === 'android' ? insets.top : 0,
      }
    ]}>
      <View style={styles.content}>
        {children}
      </View>
      {showTabBar && <TabBar />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  content: {
    flex: 1,
  },
}); 