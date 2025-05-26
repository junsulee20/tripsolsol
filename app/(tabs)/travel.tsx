import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import TravelListScreen from '../travel/list';

export default function TravelTabScreen() {
  return <TravelListScreen />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
}); 