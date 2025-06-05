import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { updatePassword, updateProfile, deleteUser } from 'firebase/auth';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Alert,
  Linking
} from 'react-native';
import TabLayout from '../../components/TabLayout';
import { auth, db } from '../../config/firebase';
import { getExchangeRates, MAJOR_CURRENCIES, getTodayString, testExchangeAPI } from '../../services/exchangeService';
import { ExchangeRateResponse } from '../../types';

// 캐릭터 이미지 목록 및 키값
const characterKeys = ['bear', 'dino', 'dog', 'koala', 'cat'];
const characterImages = [
  require('../../assets/images/characters/bear.png'),
  require('../../assets/images/characters/dino.png'),
  require('../../assets/images/characters/dog.png'),
  require('../../assets/images/characters/koala.png'),
  require('../../assets/images/characters/cat.png'),
];

export default function SettingsScreen() {
  const [user, setUser] = useState<any>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalMessage, setModalMessage] = useState('');
  const [modalType, setModalType] = useState<'success' | 'error'>('success');
  const [isEditingNickname, setIsEditingNickname] = useState(false);
  const [newNickname, setNewNickname] = useState(auth.currentUser?.displayName || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [isUpdatingNickname, setIsUpdatingNickname] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [selectedCharacter, setSelectedCharacter] = useState<string | null>(null);
  const [showCharacterPicker, setShowCharacterPicker] = useState(false);
  
  // 환율 정보 state
  const [exchangeRates, setExchangeRates] = useState<ExchangeRateResponse[]>([]);
  const [loadingExchange, setLoadingExchange] = useState(false);
  const [exchangeDate, setExchangeDate] = useState<string>('');
  
  // 계정 삭제 관련 state
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (auth.currentUser) {
      setUser(auth.currentUser);
      // photoURL에 키값(bear, dino 등) 저장
      setSelectedCharacter(auth.currentUser.photoURL || null);
    }
    
    // 환율 정보 로드
    loadExchangeRates();
  }, []);

  const showModal = (message: string, type: 'success' | 'error') => {
    setModalMessage(message);
    setModalType(type);
    setModalVisible(true);
    setTimeout(() => setModalVisible(false), 2000);
  };

  const handleUpdateNickname = async () => {
    if (!newNickname.trim()) {
      showModal('닉네임을 입력해주세요.', 'error');
      return;
    }

    setIsUpdatingNickname(true);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('사용자 정보를 찾을 수 없습니다.');

      await updateProfile(user, {
        displayName: newNickname.trim()
      });

      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        name: newNickname.trim()
      });

      setUser({ ...user, displayName: newNickname.trim() });
      showModal('닉네임이 성공적으로 변경되었습니다.', 'success');
      setIsEditingNickname(false);
    } catch (error) {
      showModal('닉네임 변경에 실패했습니다.', 'error');
    } finally {
      setIsUpdatingNickname(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!newPassword || !confirmPassword) {
      showModal('모든 필드를 입력해주세요.', 'error');
      return;
    }

    if (newPassword !== confirmPassword) {
      showModal('새 비밀번호가 일치하지 않습니다.', 'error');
      return;
    }

    if (newPassword.length < 6) {
      showModal('비밀번호는 6자 이상이어야 합니다.', 'error');
      return;
    }

    setIsUpdatingPassword(true);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('사용자 정보를 찾을 수 없습니다.');

      await updatePassword(user, newPassword);
      showModal('비밀번호가 성공적으로 변경되었습니다.', 'success');
      
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordChange(false);
    } catch (error: any) {
      let errorMessage = '비밀번호 변경에 실패했습니다.';
      
      if (error.code === 'auth/requires-recent-login') {
        errorMessage = '보안을 위해 다시 로그인해주세요.';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = '비밀번호가 너무 약합니다.';
      }
      
      showModal(errorMessage, 'error');
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleNewPasswordChange = (text: string) => {
    setNewPassword(text);
    if (text.length > 0 && text.length < 6) {
      setPasswordError('비밀번호는 6자 이상이어야 합니다.');
    } else {
      setPasswordError('');
    }
  };

  const handleSignOut = async () => {
    try {
      await auth.signOut();
      router.replace('/');
    } catch (error) {
      showModal('로그아웃에 실패했습니다.', 'error');
    }
  };

  const handlePasswordChange = () => {
    setShowPasswordChange(!showPasswordChange);
    if (!showPasswordChange) {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    }
  };

  // 캐릭터 선택 및 저장
  const handleCharacterSelect = async (imgIndex: number) => {
    const key = characterKeys[imgIndex];
    setSelectedCharacter(key);
    setShowCharacterPicker(false);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('사용자 정보를 찾을 수 없습니다.');
      await updateProfile(user, { photoURL: key });
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, { photoURL: key });
      setUser({ ...user, photoURL: key });
      showModal('프로필 이미지가 변경되었습니다.', 'success');
    } catch (error) {
      showModal('프로필 이미지 변경에 실패했습니다.', 'error');
    }
  };

  // 환율 정보 로드
  const loadExchangeRates = async () => {
    setLoadingExchange(true);
    try {
      const rates = await getExchangeRates();
      // 주요 통화만 필터링
      const majorRates = rates.filter(rate => 
        MAJOR_CURRENCIES.some(currency => rate.cur_unit.includes(currency))
      );
      setExchangeRates(majorRates);
      
      // 현재 날짜를 기본값으로 설정
      const today = getTodayString();
      const formattedDate = today.replace(/(\d{4})(\d{2})(\d{2})/, '$1.$2.$3');
      setExchangeDate(formattedDate);
    } catch (error) {
      console.error('Error loading exchange rates:', error);
      showModal('환율 정보를 불러오는데 실패했습니다.', 'error');
    } finally {
      setLoadingExchange(false);
    }
  };

  // API 연결 테스트
  const handleAPITest = async () => {
    setLoadingExchange(true);
    try {
      const result = await testExchangeAPI();
      console.log('API 테스트 결과:', result);
      showModal(result.message, result.success ? 'success' : 'error');
    } catch (error) {
      console.error('API 테스트 오류:', error);
      showModal('API 테스트 중 오류가 발생했습니다.', 'error');
    } finally {
      setLoadingExchange(false);
    }
  };

  // 계정 삭제 함수 (커스텀 모달 사용)
  const handleDeleteAccount = async () => {
    setShowDeleteConfirm(true);
  };

  const confirmDeleteAccount = async () => {
    setShowDeleteConfirm(false);
    setIsDeletingAccount(true);
    
    try {
      console.log('계정 삭제 시작...');
      const user = auth.currentUser;
      if (!user) {
        throw new Error('사용자 정보를 찾을 수 없습니다.');
      }

      console.log('사용자 UID:', user.uid);

      // 1. Firestore에서 사용자 문서 삭제
      console.log('Firestore 문서 삭제 중...');
      const userRef = doc(db, 'users', user.uid);
      await deleteDoc(userRef);
      console.log('Firestore 문서 삭제 완료');

      // 2. Firebase Auth에서 사용자 계정 삭제
      console.log('Firebase Auth 계정 삭제 중...');
      await deleteUser(user);
      console.log('Firebase Auth 계정 삭제 완료');

      // 3. 성공 메시지 표시 후 로그인 화면으로 이동
      showModal('계정이 성공적으로 삭제되었습니다.', 'success');
      
      setTimeout(() => {
        router.replace('/');
      }, 2000);

    } catch (error: any) {
      console.error('계정 삭제 오류:', error);
      console.error('오류 코드:', error.code);
      console.error('오류 메시지:', error.message);
      
      let errorMessage = '계정 삭제에 실패했습니다.';
      
      if (error.code === 'auth/requires-recent-login') {
        errorMessage = '보안을 위해 다시 로그인 후 시도해주세요.';
      } else if (error.code === 'auth/network-request-failed') {
        errorMessage = '네트워크 오류가 발생했습니다. 다시 시도해주세요.';
      }
      
      showModal(errorMessage, 'error');
    } finally {
      setIsDeletingAccount(false);
    }
  };

  // 이용약관 링크 열기
  const openTermsOfService = async () => {
    try {
      const url = 'https://v0-trip-sol-sol-terms.vercel.app/';
      const supported = await Linking.canOpenURL(url);
      
      if (supported) {
        await Linking.openURL(url);
      } else {
        showModal('링크를 열 수 없습니다.', 'error');
      }
    } catch (error) {
      console.error('링크 열기 오류:', error);
      showModal('링크를 열 수 없습니다.', 'error');
    }
  };

  return (
    <TabLayout>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>설정</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.profileSection}>
          <View style={styles.profileHeader}>
            <View style={styles.profileImageContainer}>
              <Image
                source={
                  selectedCharacter && characterKeys.includes(selectedCharacter)
                    ? characterImages[characterKeys.indexOf(selectedCharacter)]
                    : characterImages[0]
                }
                style={styles.profileImage}
                resizeMode="contain"
              />
              {isEditingNickname && (
                <TouchableOpacity style={styles.editImageButton} onPress={() => setShowCharacterPicker(true)}>
                  <Ionicons name="create-outline" size={20} color="#4A90E2" />
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.userEmail}>{user?.email}</Text>
              {isEditingNickname ? (
                <View style={styles.nicknameEditContainer}>
                  <TextInput
                    style={styles.nicknameInput}
                    value={newNickname}
                    onChangeText={setNewNickname}
                    placeholder="새 닉네임"
                    placeholderTextColor="rgba(0, 0, 0, 0.3)"
                    editable={!isUpdatingNickname}
                  />
                  <View style={styles.nicknameEditActions}>
                    <TouchableOpacity
                      style={[styles.nicknameEditButton, styles.cancelButton]}
                      onPress={() => {
                        setIsEditingNickname(false);
                        setNewNickname(user?.displayName || '');
                      }}
                      disabled={isUpdatingNickname}
                    >
                      <Text style={styles.nicknameEditButtonText}>취소</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.nicknameEditButton, styles.saveButton]}
                      onPress={handleUpdateNickname}
                      disabled={isUpdatingNickname}
                    >
                      {isUpdatingNickname ? (
                        <ActivityIndicator size="small" color="white" />
                      ) : (
                        <Text style={[styles.nicknameEditButtonText, styles.saveButtonText]}>저장</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={styles.nicknameContainer}>
                  <Text style={styles.userName}>{user?.displayName || '닉네임 없음'}</Text>
                  <TouchableOpacity
                    style={styles.editProfileButton}
                    onPress={() => setIsEditingNickname(true)}
                  >
                    <Ionicons name="create-outline" size={20} color="#4A90E2" />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('./settlements')}>
            <View style={styles.menuIcon}>
              <Ionicons name="wallet-outline" size={20} color="#333" />
            </View>
            <Text style={styles.menuText}>정산 내역</Text>
          </TouchableOpacity>
          
          {/* 환율 정보 박스 */}
          <View style={styles.exchangeRateContainer}>
            <View style={styles.exchangeRateHeader}>
              <View style={styles.exchangeRateIcon}>
                <Ionicons name="cash-outline" size={20} color="#333" />
              </View>
              <Text style={styles.exchangeRateTitle}>오늘의 환율 정보</Text>
              <TouchableOpacity onPress={loadExchangeRates} disabled={loadingExchange} style={styles.refreshButton}>
                <Ionicons 
                  name="refresh-outline" 
                  size={16} 
                  color={loadingExchange ? "#999" : "#4A90E2"} 
                />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleAPITest} disabled={loadingExchange} style={styles.testButton}>
                <Ionicons 
                  name="bug-outline" 
                  size={16} 
                  color={loadingExchange ? "#999" : "#FF6B6B"} 
                />
              </TouchableOpacity>
            </View>
            <Text style={styles.exchangeRateDate}>{exchangeDate} 기준</Text>
            
            {loadingExchange ? (
              <View style={styles.exchangeRateLoading}>
                <ActivityIndicator size="small" color="#4A90E2" />
                <Text style={styles.exchangeRateLoadingText}>환율 정보 로딩 중...</Text>
              </View>
            ) : exchangeRates.length > 0 ? (
              <View style={styles.exchangeRateList}>
                {exchangeRates.slice(0, 8).map((rate, index) => (
                  <View key={index} style={styles.exchangeRateItem}>
                    <View style={styles.currencyInfo}>
                      <Text style={styles.exchangeRateCurrency}>{rate.cur_unit}</Text>
                      <Text style={styles.exchangeRateName}>{rate.cur_nm}</Text>
                    </View>
                    <View style={styles.rateInfo}>
                      <Text style={styles.exchangeRateLabel}>매매기준율</Text>
                      <Text style={styles.exchangeRateValue}>
                        {parseFloat(rate.kftc_deal_bas_r.replace(/,/g, '')).toLocaleString()} 원
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.exchangeRateErrorContainer}>
                <Text style={styles.exchangeRateError}>환율 정보를 불러올 수 없습니다.</Text>
                <TouchableOpacity onPress={handleAPITest} style={styles.testButtonLarge}>
                  <Text style={styles.testButtonText}>API 연결 테스트</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/qr/scan')}>
            <View style={styles.menuIcon}>
              <Ionicons name="qr-code-outline" size={20} color="#333" />
            </View>
            <Text style={styles.menuText}>QR 코드 스캔</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/qr/generate')}>
            <View style={styles.menuIcon}>
              <Ionicons name="qr-code" size={20} color="#333" />
            </View>
            <Text style={styles.menuText}>QR 코드 생성</Text>
          </TouchableOpacity>

          {/* 이용약관 메뉴 */}
          <TouchableOpacity style={styles.menuItem} onPress={openTermsOfService}>
            <View style={styles.menuIcon}>
              <Ionicons name="document-text-outline" size={20} color="#333" />
            </View>
            <Text style={styles.menuText}>이용약관</Text>
            <Ionicons name="open-outline" size={16} color="#666" style={styles.externalLinkIcon} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={handlePasswordChange}>
            <View style={styles.menuIcon}>
              <Ionicons name="lock-closed-outline" size={20} color="#333" />
            </View>
            <Text style={styles.menuText}>비밀번호 변경</Text>
          </TouchableOpacity>

          {/* 계정 삭제 메뉴 */}
          <TouchableOpacity 
            style={[styles.menuItem, styles.deleteMenuItem]} 
            onPress={handleDeleteAccount}
            disabled={isDeletingAccount}
          >
            <View style={styles.menuIcon}>
              <Ionicons name="trash-outline" size={20} color="#FF3B30" />
            </View>
            <Text style={[styles.menuText, styles.deleteMenuText]}>계정 삭제</Text>
            {isDeletingAccount && <ActivityIndicator size="small" color="#FF3B30" />}
          </TouchableOpacity>

          {showPasswordChange && (
            <View style={styles.passwordContainer}>
              <View style={styles.passwordInputWrapper}>
                <TextInput
                  style={styles.passwordInput}
                  value={newPassword}
                  onChangeText={handleNewPasswordChange}
                  placeholder="새 비밀번호"
                  placeholderTextColor="rgba(0, 0, 0, 0.3)"
                  secureTextEntry={!showNewPassword}
                />
                <TouchableOpacity
                  style={styles.passwordToggle}
                  onPress={() => setShowNewPassword(!showNewPassword)}
                >
                  <Ionicons
                    name={showNewPassword ? "eye-off-outline" : "eye-outline"}
                    size={20}
                    color="#666"
                  />
                </TouchableOpacity>
              </View>
              {passwordError ? <Text style={styles.errorText}>{passwordError}</Text> : null}

              <View style={styles.passwordInputWrapper}>
                <TextInput
                  style={styles.passwordInput}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="새 비밀번호 확인"
                  placeholderTextColor="rgba(0, 0, 0, 0.3)"
                  secureTextEntry={!showConfirmPassword}
                />
                <TouchableOpacity
                  style={styles.passwordToggle}
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  <Ionicons
                    name={showConfirmPassword ? "eye-off-outline" : "eye-outline"}
                    size={20}
                    color="#666"
                  />
                </TouchableOpacity>
              </View>
              {/* 비밀번호 일치 유효성 문구 */}
              {confirmPassword.length > 0 && newPassword !== confirmPassword && (
                <Text style={styles.errorText}>비밀번호가 일치하지 않습니다.</Text>
              )}
              <TouchableOpacity
                style={[
                  styles.updateButton,
                  (!newPassword || !confirmPassword || isUpdatingPassword) && styles.updateButtonDisabled
                ]}
                onPress={handleUpdatePassword}
                disabled={!newPassword || !confirmPassword || isUpdatingPassword}
              >
                {isUpdatingPassword ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={styles.updateButtonText}>비밀번호 변경</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>

        <TouchableOpacity
          style={styles.signOutButton}
          onPress={handleSignOut}
        >
          <Ionicons name="log-out-outline" size={16} color="#FF3B30" style={styles.signOutIcon} />
          <Text style={styles.signOutButtonText}>로그아웃</Text>
        </TouchableOpacity>

        <View style={styles.footer}>
          <Text style={styles.footerText}>made by NEXT Team</Text>
          <Text style={styles.footerText}>for</Text>
          <Text style={styles.footerText}>Product Day</Text>
        </View>
      </ScrollView>

      <Modal
        animationType="fade"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={[
            styles.modalContent,
            modalType === 'success' ? styles.successModal : styles.errorModal
          ]}>
            <Text style={styles.modalText}>{modalMessage}</Text>
          </View>
        </View>
      </Modal>

      {/* 캐릭터 선택 모달 */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showCharacterPicker}
        onRequestClose={() => setShowCharacterPicker(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.characterPickerContainer}>
            <View style={styles.characterGrid}>
              {characterImages.map((img, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={styles.characterItem}
                  onPress={() => handleCharacterSelect(idx)}
                >
                  <Image source={img} style={styles.characterImage} resizeMode="contain" />
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity onPress={() => setShowCharacterPicker(false)} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>닫기</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 계정 삭제 확인 모달 */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={showDeleteConfirm}
        onRequestClose={() => setShowDeleteConfirm(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.deleteConfirmModal}>
            <Text style={styles.deleteConfirmTitle}>계정 삭제</Text>
            <Text style={styles.deleteConfirmMessage}>
              정말로 계정을 삭제하시겠습니까?{'\n'}
              이 작업은 되돌릴 수 없으며, 모든 데이터가 영구적으로 삭제됩니다.
            </Text>
            <View style={styles.deleteConfirmButtons}>
              <TouchableOpacity
                style={styles.deleteConfirmCancelButton}
                onPress={() => setShowDeleteConfirm(false)}
              >
                <Text style={styles.deleteConfirmCancelText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteConfirmDeleteButton}
                onPress={confirmDeleteAccount}
              >
                <Text style={styles.deleteConfirmDeleteText}>삭제</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </TabLayout>
  );
}

const styles = StyleSheet.create({
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
    padding: 20,
  },
  profileSection: {
    marginBottom: 32,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  profileInfo: {
    flex: 1,
  },
  userEmail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  nicknameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  userName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  editProfileButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
  },
  nicknameEditContainer: {
    marginTop: 8,
  },
  nicknameInput: {
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 8,
  },
  nicknameEditActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  nicknameEditButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  nicknameEditButtonText: {
    fontSize: 14,
    color: '#666',
  },
  cancelButton: {
    backgroundColor: '#F8F9FA',
  },
  saveButton: {
    backgroundColor: '#4A90E2',
  },
  saveButtonText: {
    color: 'white',
  },
  section: {
    marginBottom: 32,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  menuIcon: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  menuText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  passwordContainer: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  passwordInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 8,
    marginBottom: 12,
  },
  passwordInput: {
    flex: 1,
    padding: 12,
    fontSize: 16,
  },
  passwordToggle: {
    padding: 12,
  },
  updateButton: {
    backgroundColor: '#4A90E2',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  updateButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
  updateButtonDisabled: {
    backgroundColor: '#CCCCCC',
    opacity: 0.7,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 8,
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#FF3B30',
    alignSelf: 'center',
    minWidth: 100,
  },
  signOutButtonText: {
    color: '#FF3B30',
    fontSize: 14,
    fontWeight: '500',
  },
  signOutIcon: {
    marginRight: 4,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  footerText: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  successModal: {
    backgroundColor: '#4CAF50',
  },
  errorModal: {
    backgroundColor: '#F44336',
  },
  modalText: {
    fontSize: 16,
    color: 'white',
    textAlign: 'center',
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 12,
    marginTop: 4,
    marginBottom: 8,
    marginLeft: 4,
  },
  profileImageContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    position: 'relative',
  },
  profileImage: {
    width: 40,
    height: 40,
  },
  characterPickerContainer: {
    backgroundColor: 'white',
    margin: 20,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  characterPickerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  characterGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginBottom: 16,
  },
  characterItem: {
    margin: 8,
  },
  characterImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#E3F2FD',
    resizeMode: 'contain',
  },
  closeButton: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
  },
  closeButtonText: {
    color: '#4A90E2',
    fontWeight: '600',
  },
  editImageButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: 'transparent',
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  exchangeRateContainer: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  exchangeRateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  exchangeRateIcon: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  exchangeRateTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  exchangeRateDate: {
    fontSize: 12,
    color: '#666',
  },
  exchangeRateLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  exchangeRateLoadingText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 8,
  },
  exchangeRateList: {
    marginTop: 16,
  },
  exchangeRateItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  currencyInfo: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  exchangeRateCurrency: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  exchangeRateName: {
    fontSize: 13,
    color: '#666',
  },
  rateInfo: {
    flexDirection: 'column',
    alignItems: 'flex-end',
  },
  exchangeRateLabel: {
    fontSize: 11,
    color: '#999',
    marginBottom: 2,
  },
  exchangeRateValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  exchangeRateErrorContainer: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  exchangeRateError: {
    fontSize: 12,
    color: '#FF3B30',
    textAlign: 'center',
    marginBottom: 16,
  },
  testButton: {
    padding: 8,
  },
  testButtonText: {
    color: '#4A90E2',
    fontSize: 12,
    fontWeight: '500',
  },
  testButtonLarge: {
    padding: 12,
  },
  refreshButton: {
    padding: 8,
  },
  externalLinkIcon: {
    marginLeft: 8,
  },
  deleteMenuItem: {
    borderWidth: 1,
    borderColor: '#FFE5E5',
    backgroundColor: '#FFF9F9',
  },
  deleteMenuText: {
    color: '#FF3B30',
  },
  deleteAccountButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 8,
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#FF3B30',
    alignSelf: 'center',
    minWidth: 120,
  },
  deleteAccountButtonDisabled: {
    opacity: 0.7,
  },
  deleteAccountButtonText: {
    color: '#FF3B30',
    fontSize: 14,
    fontWeight: '500',
  },
  deleteAccountIcon: {
    marginRight: 4,
  },
  deleteConfirmModal: {
    backgroundColor: 'white',
    margin: 20,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  deleteConfirmTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  deleteConfirmMessage: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  deleteConfirmButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  deleteConfirmCancelButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  deleteConfirmCancelText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#666',
  },
  deleteConfirmDeleteButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    backgroundColor: '#FF3B30',
  },
  deleteConfirmDeleteText: {
    fontSize: 16,
    fontWeight: '500',
    color: 'white',
  },
}); 