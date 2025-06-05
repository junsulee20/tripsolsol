import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
  Modal
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { signIn, onAuthStateChange, getCurrentUser } from '../../services/firebaseService';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  
  // 커스텀 모달 상태
  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalMessage, setModalMessage] = useState('');

  useEffect(() => {
    // Check if user is already logged in
    const unsubscribe = onAuthStateChange((user) => {
      if (user) {
        router.replace('/(tabs)/travel');
      }
    });

    // Check current user immediately
    const currentUser = getCurrentUser();
    if (currentUser) {
      router.replace('/(tabs)/travel');
    }

    return () => unsubscribe();
  }, []);

  // 커스텀 모달 표시 함수
  const showModal = (title: string, message: string) => {
    setModalTitle(title);
    setModalMessage(message);
    setModalVisible(true);
  };

  // 커스텀 모달 닫기
  const hideModal = () => {
    setModalVisible(false);
  };

  const handleLogin = async () => {
    if (!email || !password) {
      showModal('입력 오류', '이메일과 비밀번호를 모두 입력해주세요.');
      return;
    }

    // 이메일 형식 간단 검증
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      showModal('이메일 형식 오류', '올바른 이메일 형식을 입력해주세요.');
      return;
    }

    setLoading(true);
    try {
      console.log('로그인 시도:', email);
      await signIn(email, password);
      console.log('로그인 성공');
      router.replace('/(tabs)/travel');
    } catch (error: any) {
      console.error('로그인 오류:', error);
      console.error('오류 코드:', error.code);
      console.error('오류 메시지:', error.message);
      
      let errorTitle = '로그인 실패';
      let errorMessage = '로그인에 실패했습니다.';
      
      // Firebase 에러 코드에 따른 메시지 처리
      switch (error.code) {
        case 'auth/user-not-found':
          errorTitle = '계정을 찾을 수 없음';
          errorMessage = '등록되지 않은 이메일입니다. 회원가입을 먼저 진행해주세요.';
          break;
        case 'auth/wrong-password':
          errorTitle = '비밀번호 오류';
          errorMessage = '비밀번호가 잘못되었습니다. 다시 확인해주세요.';
          break;
        case 'auth/invalid-email':
          errorTitle = '이메일 형식 오류';
          errorMessage = '올바른 이메일 형식을 입력해주세요.';
          break;
        case 'auth/user-disabled':
          errorTitle = '계정 비활성화';
          errorMessage = '이 계정은 비활성화되었습니다. 관리자에게 문의해주세요.';
          break;
        case 'auth/too-many-requests':
          errorTitle = '너무 많은 시도';
          errorMessage = '로그인 시도가 너무 많습니다. 잠시 후 다시 시도해주세요.';
          break;
        case 'auth/network-request-failed':
          errorTitle = '네트워크 오류';
          errorMessage = '네트워크 연결을 확인하고 다시 시도해주세요.';
          break;
        case 'auth/invalid-credential':
        case 'auth/invalid-login-credentials':
          errorTitle = '로그인 정보 오류';
          errorMessage = '아이디/비밀번호가 잘못되었거나, 등록되지 않은 사용자입니다.';
          break;
        default:
          errorTitle = '로그인 실패';
          errorMessage = error.message || '알 수 없는 오류가 발생했습니다.';
          break;
      }
      
      showModal(errorTitle, errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = () => {
    router.push('/auth/signup');
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Image 
              source={require('../../assets/images/tripsolsol_logo.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>
        </View>

        <View style={styles.form}>
          <View style={styles.inputContainer}>
            <Text style={styles.label}>이메일</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>비밀번호</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
            />
          </View>

          <TouchableOpacity
            style={[styles.loginButton, loading && styles.loginButtonDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            <Text style={styles.loginButtonText}>
              {loading ? '로그인 중...' : '로그인'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.signUpButton} onPress={handleSignUp}>
            <Text style={styles.signUpButtonText}>회원가입</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Terms | Privacy Policy | Contact us</Text>
        </View>
      </ScrollView>

      <Modal
        visible={modalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={hideModal}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Ionicons name="alert-circle-outline" size={24} color="#FF3B30" />
              <Text style={styles.modalTitle}>{modalTitle}</Text>
            </View>
            <Text style={styles.modalMessage}>{modalMessage}</Text>
            <TouchableOpacity style={styles.modalButton} onPress={hideModal}>
              <Text style={styles.modalButtonText}>확인</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoContainer: {
    marginBottom: 16,
  },
  logoImage: {
    width: 180,
    height: 180,
    borderRadius: 20,
  },
  form: {
    gap: 16,
    marginBottom: 40,
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    backgroundColor: 'white',
    color: '#333',
  },
  loginButton: {
    backgroundColor: '#4A90E2',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  loginButtonDisabled: {
    opacity: 0.7,
  },
  loginButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  signUpButton: {
    backgroundColor: 'transparent',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    padding: 16,
    alignItems: 'center',
  },
  signUpButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '500',
  },
  footer: {
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#999',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: 'white',
    margin: 20,
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    minWidth: 280,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
  },
  modalMessage: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  modalButton: {
    backgroundColor: '#4A90E2',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
  },
  modalButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
}); 