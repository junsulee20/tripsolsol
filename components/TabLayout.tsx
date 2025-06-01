import React from 'react';
import { View, StyleSheet } from 'react-native';
import TabBar from './TabBar';

interface TabLayoutProps {
  children: React.ReactNode;
  showTabBar?: boolean;
}

export default function TabLayout({ children, showTabBar = true }: TabLayoutProps) {
  return (
    <View style={styles.container}>
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