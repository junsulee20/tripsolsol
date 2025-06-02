import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  TextInput
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { auth } from '../../config/firebase';
import { logout, changeEmail, changePassword } from '../../services/firebaseService';
import TabLayout from '../../components/TabLayout';

export default function SettingsScreen() {
  const [user, setUser] = useState<any>(null);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showEmailInput, setShowEmailInput] = useState(false);
  const [showPasswordInput, setShowPasswordInput] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  useEffect(() => {
    if (auth.currentUser) {
      setUser(auth.currentUser);
    }
  }, []);

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email) {
      setEmailError('');
      return false;
    }
    if (!emailRegex.test(email)) {
      setEmailError('올바른 이메일 형식이 아닙니다.');
      return false;
    }
    if (email === user?.email) {
      setEmailError('현재 이메일과 동일합니다.');
      return false;
    }
    setEmailError('');
    return true;
  };

  const validatePassword = (password: string) => {
    if (!password) {
      setPasswordError('');
      return false;
    }
    if (password.length < 6) {
      setPasswordError('비밀번호는 6자 이상이어야 합니다.');
      return false;
    }
    setPasswordError('');
    return true;
  };

  const handleLogout = async () => {
    Alert.alert(
      '로그아웃',
      '정말 로그아웃 하시겠습니까?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '로그아웃',
          onPress: async () => {
            try {
              await logout();
              router.replace('/auth/login');
            } catch (error) {
              Alert.alert('오류', '로그아웃에 실패했습니다.');
            }
          }
        }
      ]
    );
  };

  const handleEmailChange = async () => {
    if (!validateEmail(newEmail)) {
      return;
    }

    try {
      await changeEmail(newEmail);
      Alert.alert('성공', '이메일이 변경되었습니다.');
      setShowEmailInput(false);
      setNewEmail('');
      setEmailError('');
    } catch (error: any) {
      Alert.alert('오류', error.message || '이메일 변경에 실패했습니다.');
    }
  };

  const handlePasswordChange = async () => {
    if (!validatePassword(newPassword)) {
      return;
    }

    try {
      await changePassword(newPassword);
      Alert.alert('성공', '비밀번호가 변경되었습니다.');
      setShowPasswordInput(false);
      setNewPassword('');
      setPasswordError('');
      setShowPassword(false);
    } catch (error: any) {
      Alert.alert('오류', error.message || '비밀번호 변경에 실패했습니다.');
    }
  };

  const handleQRScan = () => {
    router.push('/qr/scan');
  };

  const handleQRGenerate = () => {
    router.push('/qr/generate');
  };

  const getUserInitial = () => {
    if (user?.displayName) {
      return user.displayName.charAt(0).toUpperCase();
    }
    return '빅';
  };

  const getUserName = () => {
    return user?.displayName || '빅토리아';
  };

  const getUserEmail = () => {
    return user?.email || 'bigvipvik@gmail.com';
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
          <View style={styles.profileInfo}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{getUserInitial()}</Text>
              <View style={styles.verifiedBadge}>
                <Ionicons name="checkmark" size={12} color="white" />
              </View>
            </View>
            <View style={styles.userInfo}>
              <Text style={styles.userName}>{getUserName()}</Text>
              <Text style={styles.userEmail}>{getUserEmail()}</Text>
            </View>
            <TouchableOpacity 
              style={styles.editProfileButton}
              onPress={() => router.replace('/profile/edit')}
            >
              <Ionicons name="create-outline" size={20} color="#4A90E2" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>기능</Text>
          
          <TouchableOpacity style={styles.menuItem} onPress={handleQRScan}>
            <View style={styles.menuIcon}>
              <Ionicons name="qr-code-outline" size={20} color="#333" />
            </View>
            <Text style={styles.menuText}>QR 코드 스캔</Text>
            <Ionicons name="chevron-forward" size={16} color="#999" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={handleQRGenerate}>
            <View style={styles.menuIcon}>
              <Ionicons name="qr-code" size={20} color="#333" />
            </View>
            <Text style={styles.menuText}>QR 코드 생성</Text>
            <Ionicons name="chevron-forward" size={16} color="#999" />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>계정 설정</Text>
          
          {showEmailInput ? (
            <View style={styles.inputContainer}>
              <Text style={styles.currentValue}>현재 이메일: {user?.email}</Text>
              <TextInput
                style={[styles.input, emailError ? styles.inputError : null]}
                value={newEmail}
                onChangeText={(text) => {
                  setNewEmail(text);
                  validateEmail(text);
                }}
                placeholder="새 이메일 주소"
                placeholderTextColor="#999"
                keyboardType="email-address"
                autoCapitalize="none"
              />
              {emailError ? <Text style={styles.errorText}>{emailError}</Text> : null}
              <View style={styles.buttonContainer}>
                <TouchableOpacity 
                  style={[styles.confirmButton, !newEmail || !!emailError ? styles.buttonDisabled : null]} 
                  onPress={handleEmailChange}
                  disabled={!newEmail || !!emailError}
                >
                  <Text style={styles.confirmButtonText}>확인</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.cancelButton} 
                  onPress={() => {
                    setShowEmailInput(false);
                    setNewEmail('');
                    setEmailError('');
                  }}
                >
                  <Text style={styles.cancelButtonText}>취소</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity style={styles.menuItem} onPress={() => setShowEmailInput(true)}>
              <View style={styles.menuIcon}>
                <Ionicons name="mail-outline" size={20} color="#333" />
              </View>
              <Text style={styles.menuText}>이메일 변경</Text>
              <Ionicons name="chevron-forward" size={16} color="#999" />
            </TouchableOpacity>
          )}

          {showPasswordInput ? (
            <View style={styles.inputContainer}>
              <View style={styles.passwordInputContainer}>
                <TextInput
                  style={[styles.input, styles.passwordInput, passwordError ? styles.inputError : null]}
                  value={newPassword}
                  onChangeText={(text) => {
                    setNewPassword(text);
                    validatePassword(text);
                  }}
                  placeholder="새 비밀번호"
                  placeholderTextColor="#999"
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity 
                  style={styles.passwordToggle}
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <Ionicons 
                    name={showPassword ? "eye-off-outline" : "eye-outline"} 
                    size={24} 
                    color="#666"
                  />
                </TouchableOpacity>
              </View>
              {passwordError ? <Text style={styles.errorText}>{passwordError}</Text> : null}
              <View style={styles.buttonContainer}>
                <TouchableOpacity 
                  style={[styles.confirmButton, !newPassword || !!passwordError ? styles.buttonDisabled : null]} 
                  onPress={handlePasswordChange}
                  disabled={!newPassword || !!passwordError}
                >
                  <Text style={styles.confirmButtonText}>확인</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.cancelButton} 
                  onPress={() => {
                    setShowPasswordInput(false);
                    setNewPassword('');
                    setPasswordError('');
                    setShowPassword(false);
                  }}
                >
                  <Text style={styles.cancelButtonText}>취소</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity style={styles.menuItem} onPress={() => setShowPasswordInput(true)}>
              <View style={styles.menuIcon}>
                <Ionicons name="lock-closed-outline" size={20} color="#333" />
              </View>
              <Text style={styles.menuText}>비밀번호 변경</Text>
              <Ionicons name="chevron-forward" size={16} color="#999" />
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.menuItem} onPress={handleLogout}>
            <Text style={[styles.menuText, styles.logoutText]}>로그아웃</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>made by NEXT Team</Text>
          <Text style={styles.footerText}>for</Text>
          <Text style={styles.footerText}>Product Day</Text>
        </View>
      </ScrollView>
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
  profileInfo: {
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
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FF6B6B',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    position: 'relative',
  },
  avatarText: {
    color: 'white',
    fontSize: 24,
    fontWeight: '600',
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#27ae60',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: '#666',
  },
  editProfileButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
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
  logoutText: {
    color: '#e74c3c',
    fontWeight: '500',
  },
  currentValue: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  inputContainer: {
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
  input: {
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 12,
  },
  inputError: {
    borderColor: '#e74c3c',
  },
  errorText: {
    color: '#e74c3c',
    fontSize: 12,
    marginBottom: 12,
  },
  passwordInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  passwordInput: {
    flex: 1,
    marginBottom: 0,
  },
  passwordToggle: {
    position: 'absolute',
    right: 12,
    padding: 4,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  confirmButton: {
    flex: 1,
    backgroundColor: '#4A90E2',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#BDC3C7',
  },
  confirmButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#E5E5E5',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
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
}); 