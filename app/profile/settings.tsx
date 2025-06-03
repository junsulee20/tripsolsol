import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { updatePassword, updateProfile } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
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
  View
} from 'react-native';
import TabLayout from '../../components/TabLayout';
import { auth, db } from '../../config/firebase';

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

  useEffect(() => {
    if (auth.currentUser) {
      setUser(auth.currentUser);
      // photoURL에 키값(bear, dino 등) 저장
      setSelectedCharacter(auth.currentUser.photoURL || null);
    }
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
          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/balance')}>
            <View style={styles.menuIcon}>
              <Ionicons name="wallet-outline" size={20} color="#333" />
            </View>
            <Text style={styles.menuText}>정산 내역</Text>
          </TouchableOpacity>
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

          <TouchableOpacity style={styles.menuItem} onPress={handlePasswordChange}>
            <View style={styles.menuIcon}>
              <Ionicons name="lock-closed-outline" size={20} color="#333" />
            </View>
            <Text style={styles.menuText}>비밀번호 변경</Text>
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
    </TabLayout>
  );
}

const styles = StyleSheet.create({
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
}); 