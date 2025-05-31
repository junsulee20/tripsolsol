import React, { useState } from 'react';
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
  Modal
} from 'react-native';
import { router } from 'expo-router';
import { signUp } from '../../services/firebaseService';
import { Ionicons } from '@expo/vector-icons';
import { FirebaseError } from 'firebase/app';

export default function SignUpScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  
  // 커스텀 모달 상태
  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalMessage, setModalMessage] = useState('');
  const [modalButtons, setModalButtons] = useState<Array<{text: string, onPress: () => void, style?: 'default' | 'cancel' | 'primary'}>>([]);

  // 커스텀 모달 표시 함수
  const showCustomModal = (title: string, message: string, buttons: Array<{text: string, onPress: () => void, style?: 'default' | 'cancel' | 'primary'}>) => {
    setModalTitle(title);
    setModalMessage(message);
    setModalButtons(buttons);
    setModalVisible(true);
  };

  // 커스텀 모달 닫기
  const hideModal = () => {
    setModalVisible(false);
  };

  const handleSignUp = async () => {
    if (!name || !email || !password || !confirmPassword) {
      showCustomModal('오류', '모든 필드를 입력해주세요.', [
        { text: '확인', onPress: hideModal }
      ]);
      return;
    }

    if (password !== confirmPassword) {
      showCustomModal('오류', '비밀번호가 일치하지 않습니다.', [
        { text: '확인', onPress: hideModal }
      ]);
      return;
    }

    if (password.length < 6) {
      showCustomModal('비밀번호가 너무 짧습니다', '비밀번호는 최소 6자리 이상 입력해주세요.', [
        { text: '확인', onPress: hideModal }
      ]);
      return;
    }

    if (!agreeTerms) {
      showCustomModal('약관 동의 필요', '이용약관과 개인정보 처리방침에 동의해주세요.', [
        { text: '확인', onPress: hideModal }
      ]);
      return;
    }

    setLoading(true);
    try {
      const user = await signUp(email, password, name);
      console.log('회원가입 성공:', user); // 디버깅용 로그
      
      showCustomModal('회원가입 완료', '환영합니다! 회원가입이 완료되었습니다.', [
        { 
          text: '시작하기', 
          onPress: () => {
            hideModal();
            router.replace('/travel/list');
          },
          style: 'primary'
        }
      ]);
    } catch (error: any) {
      console.error('회원가입 에러:', error); // 디버깅용 로그
      console.error('에러 메시지:', error.message); // 에러 메시지 확인
      console.error('에러 코드:', error.code); // Firebase 에러 코드 확인
      
      if (error.code === 'auth/email-already-in-use' || error.message === '이미 사용 중인 이메일입니다.') {
        console.log('이미 가입된 이메일 모달 표시 시도...'); // 디버깅용 로그
        showCustomModal('이미 가입된 이메일', '해당 이메일로 이미 가입된 계정이 있습니다. 로그인을 시도해주세요.', [
          {
            text: '로그인하기',
            onPress: () => {
              hideModal();
              router.replace('/auth/login');
            },
            style: 'primary'
          },
          {
            text: '다른 이메일 사용',
            onPress: hideModal,
            style: 'cancel'
          }
        ]);
      } else if (error.code === 'auth/weak-password' || error.message === '비밀번호가 너무 약합니다.') {
        console.log('비밀번호 약함 모달 표시 시도...'); // 디버깅용 로그
        showCustomModal('비밀번호가 너무 짧습니다', '비밀번호는 최소 6자리 이상 입력해주세요.', [
          { text: '확인', onPress: hideModal }
        ]);
      } else if (error.code === 'auth/invalid-email' || error.message === '유효하지 않은 이메일 형식입니다.') {
        console.log('이메일 형식 오류 모달 표시 시도...'); // 디버깅용 로그
        showCustomModal('이메일 형식 오류', '올바른 이메일 형식을 입력해주세요.', [
          { text: '확인', onPress: hideModal }
        ]);
      } else {
        console.log('기타 오류 모달 표시 시도...'); // 디버깅용 로그
        showCustomModal('회원가입 실패', error.message || '알 수 없는 오류가 발생했습니다.', [
          { text: '확인', onPress: hideModal }
        ]);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = () => {
    router.back();
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={handleLogin} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <View style={styles.logoContainer}>
          <View style={styles.logo}>
            <View style={styles.logoIcon}>
              <Ionicons name="people" size={20} color="white" />
            </View>
          </View>
        </View>
        <View style={styles.placeholder} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <Text style={styles.title}>회원가입</Text>

        <View style={styles.form}>
          <View style={styles.inputContainer}>
            <Text style={styles.label}>이메일</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="example@email.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>닉네임</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="닉네임을 입력하세요"
              autoCapitalize="words"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>비밀번호</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              secureTextEntry
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>비밀번호 확인</Text>
            <TextInput
              style={styles.input}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="••••••••"
              secureTextEntry
              autoCapitalize="none"
            />
          </View>

          <View style={styles.checkboxContainer}>
            <TouchableOpacity
              style={styles.checkbox}
              onPress={() => setAgreeTerms(!agreeTerms)}
            >
              {agreeTerms && <Ionicons name="checkmark" size={16} color="#4A90E2" />}
            </TouchableOpacity>
            <Text style={styles.checkboxText}>
              이용약관과 개인정보 처리방침에 동의합니다
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.signUpButton, loading && styles.signUpButtonDisabled]}
            onPress={handleSignUp}
            disabled={loading}
          >
            <Text style={styles.signUpButtonText}>
              {loading ? '가입 중...' : '회원가입'}
            </Text>
          </TouchableOpacity>
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
            <Text style={styles.modalTitle}>{modalTitle}</Text>
            <Text style={styles.modalMessage}>{modalMessage}</Text>
            <View style={styles.modalButtonsContainer}>
              {modalButtons.map((button, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.modalButton, 
                    button.style === 'cancel' && styles.modalButtonCancel
                  ]}
                  onPress={button.onPress}
                >
                  <Text style={[
                    styles.modalButtonText,
                    button.style === 'cancel' && styles.modalButtonCancelText
                  ]}>
                    {button.text}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: 'white',
  },
  backButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    alignItems: 'center',
  },
  logo: {
    width: 60,
    height: 60,
    borderRadius: 12,
    backgroundColor: '#E5E5E5',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
  },
  logoIcon: {
    width: 36,
    height: 36,
    borderRadius: 6,
    backgroundColor: '#4A90E2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholder: {
    width: 32,
  },
  scrollContainer: {
    flexGrow: 1,
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    marginBottom: 32,
  },
  form: {
    flex: 1,
  },
  inputContainer: {
    marginBottom: 20,
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
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#4A90E2',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxText: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  signUpButton: {
    backgroundColor: '#4A90E2',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  signUpButtonDisabled: {
    opacity: 0.7,
  },
  signUpButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    width: '80%',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  modalMessage: {
    fontSize: 14,
    color: '#666',
    marginBottom: 24,
  },
  modalButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    gap: 12,
  },
  modalButton: {
    backgroundColor: '#4A90E2',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    flex: 1,
  },
  modalButtonCancel: {
    backgroundColor: '#E5E5E5',
  },
  modalButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  modalButtonCancelText: {
    color: '#666',
  },
}); 