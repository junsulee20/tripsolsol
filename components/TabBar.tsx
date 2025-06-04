import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';

interface TabBarProps {
  style?: any;
}

export default function TabBar({ style }: TabBarProps) {
  const pathname = usePathname();

  const tabs = [
    {
      name: 'travel',
      title: '여행',
      icon: 'airplane',
      route: '/(tabs)/travel',
      isActive: pathname.startsWith('/travel') || pathname.startsWith('/(tabs)/travel') || pathname.startsWith('/trip')
    },
    {
      name: 'expense',
      title: '비용 추가',
      icon: 'add-circle',
      route: '/expense',
      isActive: pathname.startsWith('/expense')
    },
    {
      name: 'settings',
      title: '설정',
      icon: 'person',
      route: '/profile/settings',
      isActive: pathname.startsWith('/profile')
    }
  ];

  const handleTabPress = (route: string) => {
    router.push(route as any);
  };

  return (
    <View style={[styles.container, style]}>
      {tabs.map((tab) => (
        <TouchableOpacity
          key={tab.name}
          style={styles.tab}
          onPress={() => handleTabPress(tab.route)}
        >
          <Ionicons
            name={tab.icon as any}
            size={24}
            color={tab.isActive ? '#4A90E2' : '#999'}
          />
          <Text style={[
            styles.tabText,
            { color: tab.isActive ? '#4A90E2' : '#999' }
          ]}>
            {tab.title}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
    paddingVertical: 8,
    paddingBottom: Platform.OS === 'ios' ? 24 : 8,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  tabText: {
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
  },
}); 