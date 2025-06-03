import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { auth } from '../../config/firebase';

export default function QRGenerateScreen() {
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    if (auth.currentUser) {
      setUser(auth.currentUser);
    }
  }, []);

  const handleShare = () => {
    Alert.alert('공유', 'QR 코드 공유 기능은 준비 중입니다.');
  };

  const handleSave = () => {
    Alert.alert('저장', 'QR 코드가 갤러리에 저장되었습니다.');
  };

  const getUserName = () => {
    return user?.displayName || 'Victoria';
  };

  const getUserInitial = () => {
    const name = getUserName();
    return name.charAt(0).toUpperCase();
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>QR 코드 생성</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.content}>
        <View style={styles.qrContainer}>
          <View style={styles.userInfo}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{getUserInitial()}</Text>
            </View>
            <Text style={styles.userName}>{getUserName()}</Text>
          </View>

          <View style={styles.qrCode}>
            {/* QR 코드 패턴을 시뮬레이션 */}
            <View style={styles.qrPattern}>
              {Array.from({ length: 15 }, (_, row) => (
                <View key={row} style={styles.qrRow}>
                  {Array.from({ length: 15 }, (_, col) => (
                    <View
                      key={col}
                      style={[
                        styles.qrPixel,
                        (row + col) % 3 === 0 && styles.qrPixelFilled
                      ]}
                    />
                  ))}
                </View>
              ))}
            </View>
          </View>

          <Text style={styles.instruction}>
            놓치지 못하시겠죠?
          </Text>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
            <Ionicons name="share-outline" size={20} color="#4A90E2" />
            <Text style={styles.actionButtonText}>공유하기</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionButton} onPress={handleSave}>
            <Ionicons name="download-outline" size={20} color="#4A90E2" />
            <Text style={styles.actionButtonText}>저장하기</Text>
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
  backButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  placeholder: {
    width: 32,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  qrContainer: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 40,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
    marginBottom: 40,
  },
  userInfo: {
    alignItems: 'center',
    marginBottom: 30,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FF6B6B',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: {
    color: 'white',
    fontSize: 24,
    fontWeight: '600',
  },
  userName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
  },
  qrCode: {
    width: 200,
    height: 200,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  qrPattern: {
    flex: 1,
    flexDirection: 'column',
  },
  qrRow: {
    flex: 1,
    flexDirection: 'row',
  },
  qrPixel: {
    flex: 1,
    backgroundColor: 'white',
    margin: 0.5,
  },
  qrPixelFilled: {
    backgroundColor: '#333',
  },
  instruction: {
    fontSize: 14,
    color: '#4A90E2',
    textAlign: 'center',
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