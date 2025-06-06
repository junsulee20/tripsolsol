import React, { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
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
  Modal,
  ActivityIndicator
} from 'react-native';
import { createTrip, searchUserByName, getCurrentUser } from '../../services/firebaseService';
import { User } from '../../types';
import TabLayout from '../../components/TabLayout';
import { fonts } from '../../styles/globalStyles';

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

// 여행 이모지 목록
const TRAVEL_EMOJIS = [
  '✈️', '🏖️', '🏔️', '🗺️', '🎒', 
  '🚗', '🚢', '🏕️', '🎡', '🏰'
];

export default function CreateTripScreen() {
  const [tripName, setTripName] = useState('');
  const [emoji, setEmoji] = useState('✈️');
  const [showEmojiModal, setShowEmojiModal] = useState(false);
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [startDateInput, setStartDateInput] = useState('');
  const [endDateInput, setEndDateInput] = useState('');
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [dateInputMode, setDateInputMode] = useState(false); // 수동 입력 모드
  const [participants, setParticipants] = useState<User[]>([]);
  const [newParticipantName, setNewParticipantName] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);

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

  const handleCreateTrip = async () => {
    if (!tripName.trim()) {
      showAlert('오류', '여행 이름을 입력해주세요.');
      return;
    }

    if (!validateDates()) {
      return;
    }

    const currentUser = getCurrentUser();
    if (!currentUser) {
      showAlert('오류', '로그인이 필요합니다.');
      router.replace('/auth/login');
      return;
    }

    setLoading(true);
    try {
      const participantIds = [currentUser.uid, ...participants.map(p => p.id)];

      const tripData = {
        name: tripName.trim(),
        emoji: emoji.trim() || '✈️',
        description: description.trim(),
        startDate,
        endDate,
        participants: participantIds,
        createdBy: currentUser.uid,
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
      console.error('Error creating trip:', error);
      showAlert('오류', error.message || '여행 생성에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const selectEmoji = (selectedEmoji: string) => {
    setEmoji(selectedEmoji);
    setShowEmojiModal(false);
  };

  const renderEmojiItem = ({ item }: { item: string }) => (
    <TouchableOpacity 
      style={styles.emojiItem}
      onPress={() => selectEmoji(item)}
    >
      <Text style={styles.emojiText}>{item}</Text>
    </TouchableOpacity>
  );

  const renderParticipantItem = ({ item }: { item: User }) => (
    <View style={styles.participantItem}>
      <View style={styles.participantInfo}>
        <View style={styles.participantAvatar}>
          <Text style={styles.participantAvatarText}>
            {item.name.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View>
          <Text style={styles.participantName}>{item.name}</Text>
          <Text style={styles.participantEmail}>회원번호: {generateMemberNumber(item.id)}</Text>
        </View>
      </View>
      <TouchableOpacity
        onPress={() => removeParticipant(item.id)}
        style={styles.removeButton}
      >
        <Ionicons name="close-circle" size={24} color="#FF6B6B" />
      </TouchableOpacity>
    </View>
  );

  const renderSearchResultItem = ({ item }: { item: User }) => (
    <TouchableOpacity
      style={styles.searchResultItem}
      onPress={() => addParticipant(item)}
    >
      <View style={styles.participantAvatar}>
        <Text style={styles.participantAvatarText}>
          {item.name.charAt(0).toUpperCase()}
        </Text>
      </View>
      <View style={styles.searchResultInfo}>
        <Text style={styles.participantName}>{item.name}</Text>
        <Text style={styles.participantEmail}>회원번호: {generateMemberNumber(item.id)}</Text>
      </View>
      <Ionicons name="add-circle" size={24} color="#4A90E2" />
    </TouchableOpacity>
  );

  // 웹용 날짜 입력 컴포넌트
  const renderWebDateInput = (
    label: string,
    value: Date,
    inputValue: string,
    onInputChange: (text: string) => void,
    isStartDate: boolean
  ) => (
    <View style={styles.dateInputContainer}>
      <Text style={styles.label}>{label} *</Text>
      {Platform.OS === 'web' ? (
        <input
          type="date"
          value={inputValue || formatDateForInput(value)}
          onChange={(e) => onInputChange(e.target.value)}
          style={{
            width: '100%',
            padding: 12,
            border: '1px solid #E5E5E5',
            borderRadius: 8,
            fontSize: 16,
            backgroundColor: 'white',
            color: '#333'
          }}
          min={isStartDate ? formatDateForInput(new Date()) : formatDateForInput(startDate)}
        />
      ) : (
        <TouchableOpacity
          style={styles.dateInput}
          onPress={() => isStartDate ? setShowStartPicker(true) : setShowEndPicker(true)}
        >
          <Text style={styles.dateText}>
            {value.toLocaleDateString('ko-KR')}
          </Text>
          <Ionicons name="calendar" size={20} color="#4A90E2" />
        </TouchableOpacity>
      )}
    </View>
  );

  // 수동 입력용 날짜 컴포넌트
  const renderManualDateInput = (
    label: string,
    value: string,
    onInputChange: (text: string) => void,
    placeholder: string
  ) => (
    <View style={styles.dateInputContainer}>
      <Text style={styles.label}>{label} *</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onInputChange}
        placeholder={placeholder}
        maxLength={10}
      />
    </View>
  );

  return (
    <TabLayout>
      <KeyboardAvoidingView 
        style={styles.container} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#2c3e50" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>새 여행 만들기</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView 
          style={styles.content} 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
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
              <TouchableOpacity
                style={styles.emojiSelector}
                onPress={() => setShowEmojiModal(true)}
              >
                <Text style={styles.selectedEmoji}>{emoji}</Text>
                <Text style={styles.emojiSelectorText}>이모지 선택</Text>
                <Ionicons name="chevron-down" size={20} color="#4A90E2" />
              </TouchableOpacity>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>여행 설명</Text>
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

            {/* 날짜 입력 모드 선택 */}
            {Platform.OS !== 'web' && (
              <View style={styles.inputContainer}>
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
              </View>
            )}

            <View style={styles.dateContainer}>
              {Platform.OS === 'web' ? (
                // 웹에서는 HTML input 사용
                <>
                  {renderWebDateInput('시작일', startDate, startDateInput, handleStartDateInputChange, true)}
                  {renderWebDateInput('종료일', endDate, endDateInput, handleEndDateInputChange, false)}
                </>
              ) : dateInputMode ? (
                // 모바일에서 수동 입력 모드
                <>
                  {renderManualDateInput('시작일', startDateInput, handleStartDateInputChange, 'YYYY-MM-DD')}
                  {renderManualDateInput('종료일', endDateInput, handleEndDateInputChange, 'YYYY-MM-DD')}
                </>
              ) : (
                // 모바일에서 달력 선택 모드
                <>
                  <View style={styles.dateInputContainer}>
                    <Text style={styles.label}>시작일 *</Text>
                    <TouchableOpacity
                      style={styles.dateInput}
                      onPress={() => setShowStartPicker(true)}
                    >
                      <Text style={styles.dateText}>
                        {startDate.toLocaleDateString('ko-KR')}
                      </Text>
                      <Ionicons name="calendar" size={20} color="#4A90E2" />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.dateInputContainer}>
                    <Text style={styles.label}>종료일 *</Text>
                    <TouchableOpacity
                      style={styles.dateInput}
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
                display={Platform.OS === 'ios' ? 'compact' : 'default'}
                onChange={onStartDateChange}
                minimumDate={new Date()}
              />
            )}

            {Platform.OS !== 'web' && showEndPicker && (
              <DateTimePicker
                value={endDate}
                mode="date"
                display={Platform.OS === 'ios' ? 'compact' : 'default'}
                onChange={onEndDateChange}
                minimumDate={startDate}
              />
            )}

            <View style={styles.inputContainer}>
              <Text style={styles.label}>참가자 추가</Text>
              <View style={styles.searchContainer}>
                <TextInput
                  style={styles.searchInput}
                  value={newParticipantName}
                  onChangeText={(text) => {
                    setNewParticipantName(text);
                    searchParticipants(text);
                  }}
                  placeholder="닉네임으로 검색"
                  maxLength={50}
                />
                {searchLoading && (
                  <Text style={styles.searchLoading}>검색 중...</Text>
                )}
              </View>

              {searchResults.length > 0 && (
                <View style={styles.searchResults}>
                  <FlatList
                    data={searchResults}
                    renderItem={renderSearchResultItem}
                    keyExtractor={(item) => item.id}
                    scrollEnabled={false}
                  />
                </View>
              )}

              {participants.length > 0 && (
                <View style={styles.participantsList}>
                  <Text style={styles.participantsTitle}>
                    참가자 ({participants.length + 1}명)
                  </Text>
                  <FlatList
                    data={participants}
                    renderItem={renderParticipantItem}
                    keyExtractor={(item) => item.id}
                    scrollEnabled={false}
                  />
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

        {/* 이모지 선택 모달 */}
        <Modal
          visible={showEmojiModal}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowEmojiModal(false)}
        >
          <View style={styles.modalContainer}>
            <View style={styles.emojiModalContent}>
              <View style={styles.emojiModalHeader}>
                <Text style={styles.emojiModalTitle}>여행 이모지 선택</Text>
                <TouchableOpacity onPress={() => setShowEmojiModal(false)}>
                  <Ionicons name="close" size={24} color="#333" />
                </TouchableOpacity>
              </View>
              <FlatList
                data={TRAVEL_EMOJIS}
                renderItem={renderEmojiItem}
                keyExtractor={(item, index) => index.toString()}
                horizontal
                showsHorizontalScrollIndicator={false}
                pagingEnabled
                snapToInterval={280} // 이모지 5개 너비만큼
                snapToAlignment="start"
                decelerationRate="fast"
                style={styles.emojiGrid}
                contentContainerStyle={styles.emojiGridContent}
              />
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </TabLayout>
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
    paddingTop: 0,
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
  },
  scrollContent: {
    padding: 20,
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
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: 'white',
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
    marginBottom: 20,
  },
  dateInputContainer: {
    flex: 0.48,
  },
  dateInput: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 8,
    padding: 12,
    backgroundColor: 'white',
  },
  dateText: {
    fontSize: 16,
    color: '#333',
  },
  searchContainer: {
    marginBottom: 10,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: 'white',
  },
  searchLoading: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    fontStyle: 'italic',
  },
  searchResults: {
    backgroundColor: 'white',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    marginBottom: 10,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  searchResultInfo: {
    flex: 1,
    marginLeft: 12,
  },
  participantsList: {
    backgroundColor: 'white',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    padding: 12,
  },
  participantsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  participantItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  participantInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  participantAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#4A90E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  participantAvatarText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  participantName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  participantEmail: {
    fontSize: 14,
    color: '#666',
  },
  removeButton: {
    padding: 4,
  },
  createButton: {
    backgroundColor: '#4A90E2',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  createButtonDisabled: {
    backgroundColor: '#CCCCCC',
  },
  createButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  emojiSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 8,
    backgroundColor: 'white',
  },
  selectedEmoji: {
    fontSize: 24,
    marginRight: 12,
  },
  emojiSelectorText: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  emojiModalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    width: '80%',
    maxWidth: 400,
  },
  emojiModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  emojiModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  emojiGrid: {
    maxHeight: 120,
  },
  emojiGridContent: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  emojiItem: {
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    margin: 5,
    borderRadius: 8,
    backgroundColor: '#F8F9FA',
    marginHorizontal: 10,
  },
  emojiText: {
    fontSize: 32,
  },
});