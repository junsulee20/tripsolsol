import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { launchImageLibrary } from 'react-native-image-picker';
import { useAuth } from "../../hooks/useAuth";
import { uploadProfileImage } from "../../services/firebaseService";

export default function EditProfileScreen() {
  const { user, updateProfile } = useAuth();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [isNameChanged, setIsNameChanged] = useState(false);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);

  /* 현재 사용자 정보 로드 */
  useEffect(() => {
    if (user?.displayName) {
      setName(user.displayName);
    }
    if (user?.photoURL) {
      setProfileImage(user.photoURL);
    }
  }, [user]);

  /* 이름 변경 감지 */
  useEffect(() => {
    setIsNameChanged(name !== user?.displayName || selectedImageUri !== null);
  }, [name, selectedImageUri, user]);

  /* 프로필 이미지 선택 */
  const handleImagePick = async () => {
    try {
      const result = await launchImageLibrary({
        mediaType: 'photo',
        includeBase64: false,
        maxHeight: 500,
        maxWidth: 500,
      });

      if (result.assets && result.assets[0]?.uri) {
        setSelectedImageUri(result.assets[0].uri);
        setIsNameChanged(true);
      }
    } catch (error) {
      Alert.alert("오류", "이미지 선택 중 문제가 발생했습니다.");
    }
  };

  /* 저장 버튼 핸들러 */
  const handleSave = async () => {
    if (!name.trim()) return Alert.alert("오류", "이름을 입력해주세요.");
    if (!user)        return Alert.alert("오류", "로그인이 필요합니다.");

    setLoading(true);
    try {
      let photoURL: string | undefined = profileImage || undefined;

      // ① 새 이미지 업로드
      if (selectedImageUri) {
        photoURL = await uploadProfileImage(selectedImageUri, user.uid);
      }

      // ② Firebase Auth + Firestore 업데이트
      await updateProfile({ displayName: name.trim(), photoURL });

      // ③ 로컬 화면 즉시 갱신 & 플래그 초기화
      setProfileImage(photoURL || null);      // 방금 올린 사진 바로 보이기
      setSelectedImageUri(null);
      setIsNameChanged(false);

      // ④ 성공 알림 → 뒤로
      Alert.alert("성공", "프로필이 업데이트되었습니다!", [
        { text: "확인", onPress: () => router.back() },
      ]);
    } catch (err: any) {
      Alert.alert("오류", err.message ?? "프로필 업데이트 실패");
    } finally {
      setLoading(false);
    }
  };

  /* 화면 */
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>프로필 수정</Text>
        <View style={styles.placeholder} />
      </View>

      {/* 본문 */}
      <View style={styles.content}>
        {/* 아바타 + 현재 이름 */}
        <View style={styles.profileSection}>
          <TouchableOpacity onPress={handleImagePick} style={styles.avatarContainer}>
            {(selectedImageUri || profileImage) ? (
              <Image 
                source={{ uri: selectedImageUri || profileImage || undefined }} 
                style={styles.avatar} 
              />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {name ? name.charAt(0).toUpperCase() : "?"}
                </Text>
              </View>
            )}
            <View style={styles.editImageButton}>
              <Ionicons name="camera" size={20} color="white" />
            </View>
          </TouchableOpacity>
          <Text style={styles.currentName}>{name || "이름을 입력하세요"}</Text>
        </View>

        {/* 폼 */}
        <View style={styles.form}>
          <Text style={styles.label}>이름</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="이름을 입력하세요"
              maxLength={50}
            />
            <Ionicons
              style={styles.editIcon}
              name="create-outline"
              size={20}
              color="#4A90E2"
            />
          </View>

          <TouchableOpacity
            style={[
              styles.saveButton,
              (!isNameChanged || loading) && styles.saveButtonDisabled
            ]}
            onPress={handleSave}
            disabled={!isNameChanged || loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveButtonText}>저장</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

/* ---------- Styles ---------- */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8F9FA" },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5E5",
  },
  backButton: { width: 32, height: 32, justifyContent: "center", alignItems: "center" },
  headerTitle: { fontSize: 18, fontWeight: "600", color: "#333" },
  placeholder: { width: 32 },

  content: { flex: 1, padding: 20 },
  profileSection: { alignItems: "center", marginBottom: 40 },

  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#FF6B6B",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: { color: "white", fontSize: 40, fontWeight: "600" },
  editImageButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#4A90E2',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'white',
  },
  currentName: { fontSize: 20, fontWeight: "600", color: "#333" },

  form: { flex: 1 },
  label: { fontSize: 16, fontWeight: "500", color: "#333", marginBottom: 12 },

  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E5E5",
    borderRadius: 8,
    backgroundColor: "white",
    paddingHorizontal: 16,
  },
  input: { flex: 1, fontSize: 16, paddingVertical: 16, color: "#333" },
  editIcon: { padding: 4 },

  saveButton: {
    backgroundColor: "#4A90E2",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginTop: 32,
  },
  saveButtonDisabled: {
    backgroundColor: "#BDC3C7",
  },
  saveButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
});
