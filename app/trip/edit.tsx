import React, { useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams, Stack } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  FlatList,
  ActivityIndicator
} from 'react-native';
import { getTripById, updateTripData, searchUserByName, getCurrentUser, getUsersByIds } from '../../services/firebaseService';
import { User, Trip } from '../../types';
import TabLayout from '../../components/TabLayout';

// 웹 환경에서 Alert를 위한 유틸리티 함수
const showAlert = (title: string, message: string) => {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n${message}`);
  } else {
    Alert.alert(title, message);
  }
};

// 회원번호 생성 함수 (Firebase ID의 맨 뒷 6자리)
const generateMemberNumber = (userId: string): string => {
  return userId.slice(-6).toUpperCase();
};

export default function EditTripScreen() {
  const { id } = useLocalSearchParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // 기존 trip/create.tsx의 상태들
  const [tripName, setTripName] = useState('');
  const [emoji, setEmoji] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [startDateInput, setStartDateInput] = useState('');
  const [endDateInput, setEndDateInput] = useState('');
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [dateInputMode, setDateInputMode] = useState(false);
  const [participants, setParticipants] = useState<User[]>([]);
  const [newParticipantName, setNewParticipantName] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  
  // 원본 여행 데이터
  const [originalTrip, setOriginalTrip] = useState<Trip | null>(null);

  // 여행 데이터 로드
  useEffect(() => {
    const loadTripData = async () => {
      if (!id || typeof id !== 'string') {
        showAlert('오류', '여행 ID가 없습니다.');
        router.back();
        return;
      }

      try {
        setLoading(true);
        
        // 여행 정보 가져오기
        const trip = await getTripById(id);
        if (!trip) {
          showAlert('오류', '여행 정보를 찾을 수 없습니다.');
          router.back();
          return;
        }

        // 참가자 정보 가져오기
        const participantUsers = await getUsersByIds(trip.participants);
        
        // 상태 업데이트
        setOriginalTrip(trip);
        setTripName(trip.name);
        setEmoji(trip.emoji || '');
        setDescription(trip.description || '');
        setStartDate(trip.startDate);
        setEndDate(trip.endDate);
        setStartDateInput(formatDateForInput(trip.startDate));
        setEndDateInput(formatDateForInput(trip.endDate));
        setParticipants(participantUsers);
        
      } catch (error) {
        console.error('Error loading trip data:', error);
        showAlert('오류', '여행 정보를 불러오는데 실패했습니다.');
        router.back();
      } finally {
        setLoading(false);
      }
    };

    loadTripData();
  }, [id]);

  const formatDateForInput = (date: Date) => {
    return date.toISOString().split('T')[0]; // YYYY-MM-DD 형식
  };

  const parseInputDate = (dateString: string): Date | null => {
    if (!dateString) return null;
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? null : date;
  };

  const onStartDateChange = (event: any, selectedDate?: Date) => {
    setShowStartPicker(false);
    if (selectedDate) {
      setStartDate(selectedDate);
      setStartDateInput(formatDateForInput(selectedDate));
      // 시작일이 종료일보다 늦으면 종료일을 시작일로 설정
      if (selectedDate >= endDate) {
        const nextDay = new Date(selectedDate);
        nextDay.setDate(nextDay.getDate() + 1);
        setEndDate(nextDay);
        setEndDateInput(formatDateForInput(nextDay));
      }
    }
  };

  const onEndDateChange = (event: any, selectedDate?: Date) => {
    setShowEndPicker(false);
    if (selectedDate && selectedDate > startDate) {
      setEndDate(selectedDate);
      setEndDateInput(formatDateForInput(selectedDate));
    } else if (selectedDate) {
      showAlert('오류', '종료일은 시작일보다 늦어야 합니다.');
    }
  };

  const handleStartDateInputChange = (text: string) => {
    setStartDateInput(text);
    const parsedDate = parseInputDate(text);
    if (parsedDate) {
      setStartDate(parsedDate);
      // 시작일이 종료일보다 늦으면 종료일을 시작일로 설정
      if (parsedDate >= endDate) {
        const nextDay = new Date(parsedDate);
        nextDay.setDate(nextDay.getDate() + 1);
        setEndDate(nextDay);
        setEndDateInput(formatDateForInput(nextDay));
      }
    }
  };

  const handleEndDateInputChange = (text: string) => {
    setEndDateInput(text);
    const parsedDate = parseInputDate(text);
    if (parsedDate && parsedDate > startDate) {
      setEndDate(parsedDate);
    }
  };

  const searchParticipants = async (name: string) => {
    if (!name.trim()) {
      setSearchResults([]);
      return;
    }

    setSearchLoading(true);
    try {
      const users = await searchUserByName(name.trim());
      // 현재 사용자와 이미 추가된 참가자는 제외
      const currentUser = getCurrentUser();
      const filteredUsers = users.filter(user => 
        user.id !== currentUser?.uid && 
        !participants.some(p => p.id === user.id)
      );
      setSearchResults(filteredUsers);
    } catch (error) {
      console.error('Error searching participants:', error);
      showAlert('오류', '참가자 검색에 실패했습니다.');
    } finally {
      setSearchLoading(false);
    }
  };

  const addParticipant = (user: User) => {
    if (participants.some(p => p.id === user.id)) {
      showAlert('오류', '이미 추가된 참가자입니다.');
      return;
    }

    setParticipants([...participants, user]);
    setNewParticipantName('');
    setSearchResults([]);
  };

  const removeParticipant = (userId: string) => {
    if (!originalTrip) return;
    
    // 여행 생성자는 삭제할 수 없음
    if (userId === originalTrip.createdBy) {
      showAlert('알림', '여행 생성자는 삭제할 수 없습니다.');
      return;
    }
    
    setParticipants(participants.filter(p => p.id !== userId));
  };

  const validateDates = () => {
    // 수동 입력 모드일 때 날짜 검증
    if (dateInputMode) {
      const startParsed = parseInputDate(startDateInput);
      const endParsed = parseInputDate(endDateInput);
      
      if (!startParsed) {
        showAlert('오류', '시작일을 올바른 형식(YYYY-MM-DD)으로 입력해주세요.');
        return false;
      }
      
      if (!endParsed) {
        showAlert('오류', '종료일을 올바른 형식(YYYY-MM-DD)으로 입력해주세요.');
        return false;
      }
      
      if (startParsed >= endParsed) {
        showAlert('오류', '종료일은 시작일보다 늦어야 합니다.');
        return false;
      }
      
      // 파싱된 날짜로 상태 업데이트
      setStartDate(startParsed);
      setEndDate(endParsed);
    } else {
      if (startDate >= endDate) {
        showAlert('오류', '종료일은 시작일보다 늦어야 합니다.');
        return false;
      }
    }
    
    return true;
  };

  const handleUpdateTrip = async () => {
    if (!tripName.trim()) {
      showAlert('오류', '여행 이름을 입력해주세요.');
      return;
    }

    if (!validateDates()) {
      return;
    }

    if (!originalTrip || !id || typeof id !== 'string') {
      showAlert('오류', '여행 정보가 없습니다.');
      return;
    }

    setSaving(true);
    try {
      const participantIds = participants.map(p => p.id);

      const updatedTripData = {
        name: tripName.trim(),
        description: description.trim(),
        emoji: emoji || '🌍',
        startDate,
        endDate,
        participants: participantIds,
        updatedAt: new Date(),
      };

      await updateTripData(id, updatedTripData);
      showAlert('성공', '여행 정보가 수정되었습니다.');
      router.back();
    } catch (error) {
      console.error('Error updating trip:', error);
      showAlert('오류', '여행 수정에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const renderParticipantItem = ({ item }: { item: User }) => (
    <View style={styles.participantItem}>
      <View style={styles.participantInfo}>
        <Text style={styles.participantName}>{item.name}</Text>
        <Text style={styles.participantEmail}>회원번호: {generateMemberNumber(item.id)}</Text>
        {originalTrip && item.id === originalTrip.createdBy && (
          <View style={styles.creatorBadge}>
            <Ionicons name="star" size={12} color="#FFD700" />
            <Text style={styles.creatorText}>생성자</Text>
          </View>
        )}
      </View>
      {originalTrip && item.id !== originalTrip.createdBy && (
        <TouchableOpacity
          style={styles.removeButton}
          onPress={() => removeParticipant(item.id)}
        >
          <Ionicons name="close" size={16} color="#FF6B6B" />
        </TouchableOpacity>
      )}
    </View>
  );

  const renderSearchResultItem = ({ item }: { item: User }) => (
    <TouchableOpacity
      style={styles.searchResultItem}
      onPress={() => addParticipant(item)}
    >
      <View style={styles.searchResultInfo}>
        <Text style={styles.searchResultName}>{item.name}</Text>
        <Text style={styles.searchResultEmail}>회원번호: {generateMemberNumber(item.id)}</Text>
      </View>
      <Ionicons name="add" size={16} color="#4A90E2" />
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <TabLayout>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4A90E2" />
          <Text style={styles.loadingText}>여행 정보를 불러오는 중...</Text>
        </View>
      </TabLayout>
    );
  }

  return (
    <TabLayout>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>여행 편집</Text>
          <TouchableOpacity
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={handleUpdateTrip}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Text style={styles.saveButtonText}>저장</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* 여행 이름 */}
          <View style={styles.inputSection}>
            <Text style={styles.label}>여행 이름</Text>
            <TextInput
              style={styles.input}
              value={tripName}
              onChangeText={setTripName}
              placeholder="여행 이름을 입력하세요"
              placeholderTextColor="#999"
            />
          </View>

          {/* 이모지 */}
          <View style={styles.inputSection}>
            <Text style={styles.label}>이모지</Text>
            <TextInput
              style={styles.input}
              value={emoji}
              onChangeText={setEmoji}
              placeholder="🌍"
              placeholderTextColor="#999"
              maxLength={2}
            />
          </View>

          {/* 설명 */}
          <View style={styles.inputSection}>
            <Text style={styles.label}>설명</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="여행에 대한 설명을 입력하세요"
              placeholderTextColor="#999"
              multiline
              numberOfLines={3}
            />
          </View>

          {/* 날짜 설정 */}
          <View style={styles.inputSection}>
            <Text style={styles.label}>여행 날짜</Text>
            
            {/* 날짜 입력 모드 선택 */}
            {Platform.OS !== 'web' && (
              <View style={styles.dateToggleContainer}>
                <TouchableOpacity
                  style={[styles.toggleButton, !dateInputMode && styles.toggleButtonActive]}
                  onPress={() => setDateInputMode(false)}
                >
                  <Ionicons name="calendar" size={16} color={!dateInputMode ? 'white' : '#4A90E2'} />
                  <Text style={[styles.toggleText, !dateInputMode && styles.toggleTextActive]}>
                    달력 선택
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.toggleButton, dateInputMode && styles.toggleButtonActive]}
                  onPress={() => {
                    setDateInputMode(true);
                    setStartDateInput(formatDateForInput(startDate));
                    setEndDateInput(formatDateForInput(endDate));
                  }}
                >
                  <Ionicons name="create" size={16} color={dateInputMode ? 'white' : '#4A90E2'} />
                  <Text style={[styles.toggleText, dateInputMode && styles.toggleTextActive]}>
                    직접 입력
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.dateContainer}>
              {Platform.OS === 'web' ? (
                // 웹에서는 HTML input 사용
                <>
                  <View style={styles.dateInputContainer}>
                    <Text style={styles.dateLabel}>시작일</Text>
                    <TextInput
                      style={styles.dateInput}
                      value={startDateInput}
                      onChangeText={handleStartDateInputChange}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor="#999"
                    />
                  </View>
                  <View style={styles.dateInputContainer}>
                    <Text style={styles.dateLabel}>종료일</Text>
                    <TextInput
                      style={styles.dateInput}
                      value={endDateInput}
                      onChangeText={handleEndDateInputChange}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor="#999"
                    />
                  </View>
                </>
              ) : dateInputMode ? (
                // 모바일에서 수동 입력 모드
                <>
                  <View style={styles.dateInputContainer}>
                    <Text style={styles.dateLabel}>시작일</Text>
                    <TextInput
                      style={styles.manualDateInput}
                      value={startDateInput}
                      onChangeText={handleStartDateInputChange}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor="#999"
                      maxLength={10}
                    />
                  </View>
                  <View style={styles.dateInputContainer}>
                    <Text style={styles.dateLabel}>종료일</Text>
                    <TextInput
                      style={styles.manualDateInput}
                      value={endDateInput}
                      onChangeText={handleEndDateInputChange}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor="#999"
                      maxLength={10}
                    />
                  </View>
                </>
              ) : (
                // 모바일에서 달력 선택 모드
                <>
                  <View style={styles.dateInputContainer}>
                    <Text style={styles.dateLabel}>시작일</Text>
                    <TouchableOpacity
                      style={styles.calendarDateInput}
                      onPress={() => setShowStartPicker(true)}
                    >
                      <Text style={styles.dateText}>
                        {startDate.toLocaleDateString('ko-KR')}
                      </Text>
                      <Ionicons name="calendar" size={20} color="#4A90E2" />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.dateInputContainer}>
                    <Text style={styles.dateLabel}>종료일</Text>
                    <TouchableOpacity
                      style={styles.calendarDateInput}
                      onPress={() => setShowEndPicker(true)}
                    >
                      <Text style={styles.dateText}>
                        {endDate.toLocaleDateString('ko-KR')}
                      </Text>
                      <Ionicons name="calendar" size={20} color="#4A90E2" />
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>

            {Platform.OS !== 'web' && showStartPicker && (
              <DateTimePicker
                value={startDate}
                mode="date"
                display="default"
                onChange={onStartDateChange}
              />
            )}

            {Platform.OS !== 'web' && showEndPicker && (
              <DateTimePicker
                value={endDate}
                mode="date"
                display="default"
                onChange={onEndDateChange}
              />
            )}
          </View>

          {/* 참가자 관리 */}
          <View style={styles.inputSection}>
            <Text style={styles.label}>참가자</Text>
            
            {/* 새 참가자 추가 */}
            <View style={styles.addParticipantContainer}>
              <TextInput
                style={styles.addParticipantInput}
                value={newParticipantName}
                onChangeText={(text) => {
                  setNewParticipantName(text);
                  searchParticipants(text);
                }}
                placeholder="참가자 이름으로 검색"
                placeholderTextColor="#999"
              />
              {searchLoading && (
                <ActivityIndicator size="small" color="#4A90E2" style={styles.searchLoader} />
              )}
            </View>

            {/* 검색 결과 */}
            {searchResults.length > 0 && (
              <FlatList
                data={searchResults}
                renderItem={renderSearchResultItem}
                keyExtractor={(item) => item.id}
                style={styles.searchResults}
                scrollEnabled={false}
              />
            )}

            {/* 현재 참가자 목록 */}
            <View style={styles.participantsSection}>
              <Text style={styles.participantsTitle}>현재 참가자 ({participants.length}명)</Text>
              <FlatList
                data={participants}
                renderItem={renderParticipantItem}
                keyExtractor={(item) => item.id}
                style={styles.participantsList}
                scrollEnabled={false}
              />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </TabLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  saveButton: {
    backgroundColor: '#4A90E2',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 60,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  inputSection: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333',
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  dateToggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#F0F0F0',
    borderRadius: 8,
    padding: 4,
    marginBottom: 16,
  },
  toggleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  toggleButtonActive: {
    backgroundColor: '#4A90E2',
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#4A90E2',
    marginLeft: 4,
  },
  toggleTextActive: {
    color: 'white',
  },
  dateContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  dateInputContainer: {
    flex: 0.48,
  },
  dateLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    marginBottom: 8,
  },
  dateInput: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333',
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  manualDateInput: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333',
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  calendarDateInput: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  dateText: {
    fontSize: 16,
    color: '#333',
  },
  participantsList: {
    marginBottom: 12,
  },
  participantItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  participantInfo: {
    flex: 1,
  },
  participantName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  participantEmail: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  creatorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  creatorText: {
    fontSize: 12,
    color: '#FFD700',
    marginLeft: 4,
    fontWeight: '500',
  },
  removeButton: {
    padding: 8,
    backgroundColor: '#FFE5E5',
    borderRadius: 20,
  },
  addParticipantContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  addParticipantInput: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333',
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  searchLoader: {
    marginLeft: 12,
  },
  searchResults: {
    maxHeight: 150,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    marginBottom: 16,
  },
  searchResultItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  searchResultInfo: {
    flex: 1,
  },
  searchResultName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  searchResultEmail: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  participantsSection: {
    marginTop: 8,
    marginBottom: 12,
  },
  participantsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 12,
    paddingLeft: 4,
  },
}); 