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
  Modal,
  Linking,
  Image
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
  const [bankAccount, setBankAccount] = useState('');
  const [loading, setLoading] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  
  // 커스텀 모달 상태
  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalMessage, setModalMessage] = useState('');
  const [modalButtons, setModalButtons] = useState<Array<{text: string, onPress: () => void, style?: 'default' | 'cancel' | 'primary'}>>([]);

  // 개인정보 처리방침 모달 상태
  const [privacyModalVisible, setPrivacyModalVisible] = useState(false);

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

  // 개인정보 처리방침 모달 열기
  const showPrivacyModal = () => {
    setPrivacyModalVisible(true);
  };

  // 개인정보 처리방침 모달 닫기
  const hidePrivacyModal = () => {
    setPrivacyModalVisible(false);
  };

  // 개인정보 처리방침 전문 링크 열기
  const openPrivacyPolicy = async () => {
    try {
      const url = 'https://v0-trip-sol-sol-terms.vercel.app/';
      const supported = await Linking.canOpenURL(url);
      
      if (supported) {
        await Linking.openURL(url);
      } else {
        showCustomModal('오류', '링크를 열 수 없습니다.', [
          { text: '확인', onPress: hideModal }
        ]);
      }
    } catch (error) {
      console.error('링크 열기 오류:', error);
      showCustomModal('오류', '링크를 열 수 없습니다.', [
        { text: '확인', onPress: hideModal }
      ]);
    }
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
      const user = await signUp(email, password, name, bankAccount);
      console.log('회원가입 성공:', user); // 디버깅용 로그
      
      showCustomModal('회원가입 완료', '환영합니다! 회원가입이 완료되었습니다.', [
        { 
          text: '시작하기', 
          onPress: () => {
            hideModal();
            router.replace('/(tabs)/travel');
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
          <Image 
            source={require('../../assets/images/tripsolsol_logo.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
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
              autoCapitalize="words"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>계좌번호</Text>
            <TextInput
              style={styles.input}
              value={bankAccount}
              onChangeText={setBankAccount}
              keyboardType="numeric"
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

          <View style={styles.inputContainer}>
            <Text style={styles.label}>비밀번호 확인</Text>
            <TextInput
              style={styles.input}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              autoCapitalize="none"
            />
          </View>

          <View style={styles.checkboxContainer}>
            <TouchableOpacity
              style={styles.checkbox}
              onPress={showPrivacyModal}
            >
              {agreeTerms && <Ionicons name="checkmark" size={16} color="#4A90E2" />}
            </TouchableOpacity>
            <TouchableOpacity onPress={showPrivacyModal} style={styles.checkboxTextContainer}>
              <Text style={styles.checkboxText}>
                이용약관과 개인정보 처리방침에 동의합니다
              </Text>
            </TouchableOpacity>
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

      {/* 개인정보 처리방침 모달 */}
      <Modal
        visible={privacyModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={hidePrivacyModal}
      >
        <View style={styles.modalContainer}>
          <View style={styles.privacyModalContent}>
            <View style={styles.privacyModalHeader}>
              <Text style={styles.privacyModalTitle}>개인정보 처리방침</Text>
              <TouchableOpacity onPress={hidePrivacyModal} style={styles.closeButton}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.privacyModalBody} showsVerticalScrollIndicator={false}>
              <Text style={styles.privacyText}>
                tripsolsol은 사용자의 개인정보 보호를 위해 다음과 같이 처리방침을 운영합니다.
              </Text>
              
              <Text style={styles.privacySectionTitle}>1. 수집 항목 및 방법</Text>
              <Text style={styles.privacyText}>
                이메일, 닉네임, 접속 로그, 기기 정보 등을 회원가입 및 앱 사용 과정에서 수집합니다.
              </Text>
              
              <Text style={styles.privacySectionTitle}>2. 이용 목적</Text>
              <Text style={styles.privacyText}>
                서비스 제공, 여행 정산 내역 저장, 고객 지원, 서비스 개선 및 분석에 활용됩니다.
              </Text>
              
              <Text style={styles.privacySectionTitle}>3. 보유 및 삭제</Text>
              <Text style={styles.privacyText}>
                개인정보는 탈퇴 시 또는 목적 달성 후 즉시 삭제되며, 법령에 따라 보존이 필요한 경우 예외적으로 보관될 수 있습니다.
              </Text>
              
              <Text style={styles.privacySectionTitle}>4. 제3자 제공 및 위탁</Text>
              <Text style={styles.privacyText}>
                원칙적으로 동의 없이 외부에 제공하지 않으며, 서버 운영 등 일부 업무는 사전 동의 후 위탁할 수 있습니다.
              </Text>
              
              <Text style={styles.privacySectionTitle}>5. 이용자의 권리</Text>
              <Text style={styles.privacyText}>
                이용자는 열람, 수정, 삭제, 처리 정지를 요청할 수 있으며, 담당자 이메일로 접수 가능합니다.
              </Text>
              
              <Text style={styles.privacyText}>
                자세한 내용은 개인정보처리방침 전문을 참고해 주세요.
              </Text>
            </ScrollView>
            
            <View style={styles.privacyModalFooter}>
              <TouchableOpacity onPress={openPrivacyPolicy} style={styles.linkButton}>
                <Text style={styles.linkButtonText}>전문 보기</Text>
                <Ionicons name="open-outline" size={16} color="#4A90E2" />
              </TouchableOpacity>
              
              <TouchableOpacity 
                onPress={() => {
                  setAgreeTerms(true);
                  hidePrivacyModal();
                }} 
                style={styles.agreeButton}
              >
                <Text style={styles.agreeButtonText}>동의하고 계속</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
    paddingTop: 12,
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
  logoContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  logoImage: {
    width: 120,
    height: 120,
    borderRadius: 16,
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
    color: '#333',
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
  checkboxTextContainer: {
    flex: 1,
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
  privacyModalContent: {
    backgroundColor: 'white',
    margin: 20,
    borderRadius: 12,
    maxHeight: '80%',
    overflow: 'hidden',
  },
  privacyModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  privacyModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  closeButton: {
    padding: 4,
  },
  privacyModalBody: {
    padding: 20,
    maxHeight: 400,
  },
  privacyText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 16,
  },
  privacySectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginTop: 8,
    marginBottom: 8,
  },
  privacyModalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    borderColor: '#4A90E2',
    borderRadius: 8,
    flex: 1,
    marginRight: 10,
    justifyContent: 'center',
  },
  linkButtonText: {
    color: '#4A90E2',
    fontSize: 14,
    fontWeight: '500',
    marginRight: 4,
  },
  agreeButton: {
    backgroundColor: '#4A90E2',
    padding: 12,
    borderRadius: 8,
    flex: 1,
    marginLeft: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  agreeButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
}); 