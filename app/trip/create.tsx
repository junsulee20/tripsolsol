import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { db } from '../../config/firebase';
import { createTrip } from '../../services/firebaseService';

// 웹 환경에서 Alert를 위한 유틸리티 함수
const showAlert = (title: string, message: string) => {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n${message}`);
  } else {
    Alert.alert(title, message);
  }
};

export default function CreateTripScreen() {
  const [tripName, setTripName] = useState('');
  const [emoji, setEmoji] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [participants, setParticipants] = useState<string[]>([]);
  const [participantEmails, setParticipantEmails] = useState<{[key: string]: string}>({});
  const [newParticipant, setNewParticipant] = useState('');
  const [loading, setLoading] = useState(false);

  const addParticipant = async () => {
    if (!newParticipant.trim()) {
      showAlert('오류', '참가자 이메일을 입력해주세요.');
      return;
    }
    try {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('email', '==', newParticipant.trim()));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        showAlert('오류', '해당 이메일의 사용자를 찾을 수 없습니다.');
        return;
      }

      const userDoc = querySnapshot.docs[0];
      const userId = userDoc.id;
      const userData = userDoc.data();

      if (participants.includes(userId)) {
        showAlert('오류', '이미 추가된 참가자입니다.');
        return;
      }

      setParticipants([...participants, userId]);
      setParticipantEmails({
        ...participantEmails,
        [userId]: userData.email
      });
      setNewParticipant('');
    } catch (error) {
      showAlert('오류', '참가자 추가에 실패했습니다.');
    }
  };

  const removeParticipant = (userId: string) => {
    setParticipants(participants.filter(p => p !== userId));
    const newEmails = { ...participantEmails };
    delete newEmails[userId];
    setParticipantEmails(newEmails);
  };

  const handleCreateTrip = async () => {
    if (!tripName.trim()) {
      showAlert('오류', '여행 이름을 입력해주세요.');
      return;
    }
    if (!startDate || !endDate) {
      showAlert('오류', '여행 날짜를 입력해주세요.');
      return;
    }
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
      showAlert('오류', '날짜는 YYYY-MM-DD 형식으로 입력해주세요.');
      return;
    }
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      showAlert('오류', '유효하지 않은 날짜입니다.');
      return;
    }
    if (start >= end) {
      showAlert('오류', '종료일은 시작일보다 늦어야 합니다.');
      return;
    }

    setLoading(true);
    try {
      // 로그인 기능이 없으므로 mock user 사용
      const userId = 'test-user-id';

      const tripData = {
        name: tripName.trim(),
        emoji: emoji.trim(),
        description: description.trim(),
        startDate: start,
        endDate: end,
        participants: [userId, ...participants],
        createdBy: userId,
        createdAt: new Date(),
        currency: 'KRW',
        totalAmount: 0
      };

      const tripId = await createTrip(tripData);

      if (Platform.OS === 'web') {
        window.alert('여행이 생성되었습니다!');
        router.push(`/trip/${tripId}`);
      } else {
        Alert.alert('성공', '여행이 생성되었습니다!', [
          { text: '확인', onPress: () => router.push(`/trip/${tripId}`) }
        ]);
      }
    } catch (error: any) {
      showAlert('오류', error.message || '여행 생성에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#2c3e50" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>새 여행 만들기</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.form}>
          <View style={styles.inputContainer}>
            <Text style={styles.label}>여행 이름 *</Text>
            <TextInput
              style={styles.input}
              value={tripName}
              onChangeText={setTripName}
              placeholder="예: 제주도 여행"
              maxLength={50}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>여행 이모지</Text>
            <TextInput
              style={styles.input}
              value={emoji}
              onChangeText={setEmoji}
              placeholder="예: ✈️"
              maxLength={2}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>설명</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="여행에 대한 간단한 설명을 입력하세요"
              multiline
              numberOfLines={3}
              maxLength={200}
            />
          </View>

          <View style={styles.row}>
            <View style={[styles.inputContainer, styles.halfWidth]}>
              <Text style={styles.label}>시작일 *</Text>
              <TextInput
                style={styles.input}
                value={startDate}
                onChangeText={setStartDate}
                placeholder="YYYY-MM-DD"
                maxLength={10}
              />
            </View>

            <View style={[styles.inputContainer, styles.halfWidth]}>
              <Text style={styles.label}>종료일 *</Text>
              <TextInput
                style={styles.input}
                value={endDate}
                onChangeText={setEndDate}
                placeholder="YYYY-MM-DD"
                maxLength={10}
              />
            </View>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>참가자 추가</Text>
            <View style={styles.participantInputContainer}>
              <TextInput
                style={[styles.input, styles.participantInput]}
                value={newParticipant}
                onChangeText={setNewParticipant}
                placeholder="참가자 이메일 입력"
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <TouchableOpacity style={styles.addButton} onPress={addParticipant}>
                <Ionicons name="add" size={20} color="white" />
              </TouchableOpacity>
            </View>

            {participants.length > 0 && (
              <View style={styles.participantsList}>
                <Text style={styles.participantsTitle}>참가자 목록:</Text>
                {participants.map((userId, index) => (
                  <View key={index} style={styles.participantItem}>
                    <Text style={styles.participantEmail}>{participantEmails[userId]}</Text>
                    <TouchableOpacity
                      onPress={() => removeParticipant(userId)}
                      style={styles.removeButton}
                    >
                      <Ionicons name="close" size={16} color="#e74c3c" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>

          <TouchableOpacity
            style={[styles.createButton, loading && styles.createButtonDisabled]}
            onPress={handleCreateTrip}
            disabled={loading}
          >
            <Text style={styles.createButtonText}>
              {loading ? '생성 중...' : '여행 만들기'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#ecf0f1',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  form: {
    padding: 20,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: 'white',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  halfWidth: {
    width: '48%',
  },
  participantInputContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  participantInput: {
    flex: 1,
  },
  addButton: {
    backgroundColor: '#27ae60',
    borderRadius: 8,
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  participantsList: {
    marginTop: 12,
  },
  participantsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 8,
  },
  participantItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 8,
    marginBottom: 4,
  },
  participantEmail: {
    fontSize: 14,
    color: '#2c3e50',
    flex: 1,
  },
  removeButton: {
    padding: 4,
  },
  createButton: {
    backgroundColor: '#3498db',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  createButtonDisabled: {
    backgroundColor: '#bdc3c7',
  },
  createButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
