import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function CameraScreen() {
  const [loading, setLoading] = useState(false);

  const handleCamera = () => {
    Alert.alert('카메라', '카메라 기능은 준비 중입니다.');
  };

  const handleGallery = () => {
    Alert.alert('갤러리', '갤러리 기능은 준비 중입니다.');
  };

  const handleClose = () => {
    router.back();
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.tripInfo}>
          <View style={styles.tripIcon}>
            <Ionicons name="airplane" size={20} color="white" />
          </View>
          <Text style={styles.tripName}>21학번 동기 유럽 여행</Text>
        </View>
        <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
          <Ionicons name="close" size={24} color="#333" />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>영수증을 스캔해주세요</Text>
        
        <View style={styles.cameraPlaceholder}>
          <View style={styles.cameraIcon}>
            <Ionicons name="camera-outline" size={60} color="#999" />
          </View>
          <Text style={styles.placeholderText}>
            영수증 이미지를 촬영하거나 선택해주세요
          </Text>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionButton} onPress={handleCamera}>
            <Ionicons name="camera" size={20} color="#4A90E2" />
            <Text style={styles.actionButtonText}>카메라</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionButton} onPress={handleGallery}>
            <Ionicons name="images" size={20} color="#4A90E2" />
            <Text style={styles.actionButtonText}>갤러리</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  tripInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  tripIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#4A90E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  tripName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  closeButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 40,
  },
  cameraPlaceholder: {
    width: '100%',
    height: 300,
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E5E5',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
  },
  cameraIcon: {
    marginBottom: 16,
  },
  placeholderText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    gap: 20,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#4A90E2',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  actionButtonText: {
    fontSize: 16,
    color: '#4A90E2',
    fontWeight: '500',
    marginLeft: 8,
  },
}); 