import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { router } from 'expo-router';
import { auth } from '../../config/firebase';
import { createTrip } from '../../services/firebaseService';
import { Ionicons } from '@expo/vector-icons';

export default function CreateTripScreen() {
  const [tripName, setTripName] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currency, setCurrency] = useState('KRW');
  const [participants, setParticipants] = useState<string[]>([]);
  const [newParticipant, setNewParticipant] = useState('');
  const [loading, setLoading] = useState(false);

  const currencies = [
    { code: 'KRW', name: '원 (₩)' },
    { code: 'USD', name: '달러 ($)' },
    { code: 'EUR', name: '유로 (€)' },
    { code: 'JPY', name: '엔 (¥)' },
  ];

  const addParticipant = () => {
    if (!newParticipant.trim()) {
      Alert.alert('오류', '참가자 이메일을 입력해주세요.');
      return;
    }

    if (participants.includes(newParticipant.trim())) {
      Alert.alert('오류', '이미 추가된 참가자입니다.');
      return;
    }

    setParticipants([...participants, newParticipant.trim()]);
    setNewParticipant('');
  };

  const removeParticipant = (email: string) => {
    setParticipants(participants.filter(p => p !== email));
  };

  const handleCreateTrip = async () => {
    if (!tripName.trim()) {
      Alert.alert('오류', '여행 이름을 입력해주세요.');
      return;
    }

    if (!startDate || !endDate) {
      Alert.alert('오류', '여행 날짜를 입력해주세요.');
      return;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start >= end) {
      Alert.alert('오류', '종료일은 시작일보다 늦어야 합니다.');
      return;
    }

    if (!auth.currentUser) {
      Alert.alert('오류', '로그인이 필요합니다.');
      return;
    }

    setLoading(true);
    try {
      const tripData = {
        name: tripName.trim(),
        description: description.trim(),
        startDate: start,
        endDate: end,
        participants: [auth.currentUser.uid, ...participants],
        createdBy: auth.currentUser.uid,
        createdAt: new Date(),
        currency,
        totalAmount: 0
      };

      const tripId = await createTrip(tripData);
      Alert.alert('성공', '여행이 생성되었습니다!', [
        { text: '확인', onPress: () => router.back() }
      ]);
    } catch (error: any) {
      Alert.alert('오류', '여행 생성에 실패했습니다: ' + error.message);
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
            <Text style={styles.label}>통화</Text>
            <View style={styles.currencyContainer}>
              {currencies.map((curr) => (
                <TouchableOpacity
                  key={curr.code}
                  style={[
                    styles.currencyButton,
                    currency === curr.code && styles.currencyButtonSelected
                  ]}
                  onPress={() => setCurrency(curr.code)}
                >
                  <Text style={[
                    styles.currencyText,
                    currency === curr.code && styles.currencyTextSelected
                  ]}>
                    {curr.name}
                  </Text>
                </TouchableOpacity>
              ))}
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
                {participants.map((email, index) => (
                  <View key={index} style={styles.participantItem}>
                    <Text style={styles.participantEmail}>{email}</Text>
                    <TouchableOpacity
                      onPress={() => removeParticipant(email)}
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
  currencyContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  currencyButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: 'white',
  },
  currencyButtonSelected: {
    backgroundColor: '#3498db',
    borderColor: '#3498db',
  },
  currencyText: {
    fontSize: 14,
    color: '#2c3e50',
  },
  currencyTextSelected: {
    color: 'white',
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