import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Platform,
  Dimensions,
  ScrollView,
  Modal,
  Image
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { processImageWithClovaOCR, OCRResult } from '../../services/ocrService';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring
} from 'react-native-reanimated';
import TabLayout from '../../components/TabLayout';
import { fonts } from '../../styles/globalStyles';

export default function CameraScreen() {
  const { tripId, tripName } = useLocalSearchParams();
  const [loading, setLoading] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<'front' | 'back'>('back');
  const cameraRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // OCR 결과 상태 관리 (새로 추가)
  const [ocrResult, setOcrResult] = useState<OCRResult | null>(null);
  const [showOcrResult, setShowOcrResult] = useState(false);
  const [showNumberSelector, setShowNumberSelector] = useState(false);
  
  // 안정성을 위한 추가 상태들
  const [isProcessing, setIsProcessing] = useState(false); // OCR 처리 중 중복 방지
  const [buttonDisabled, setButtonDisabled] = useState(false); // 버튼 중복 클릭 방지
  const mountedRef = useRef(true); // 컴포넌트 마운트 상태 추적
  const abortControllerRef = useRef<AbortController | null>(null); // OCR 요청 취소용

  // 웹 환경에서 갤러리용 파일 input 생성
  useEffect(() => {
    if (Platform.OS === 'web') {
      if (!fileInputRef.current) {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/*';
        fileInput.style.display = 'none';
        fileInput.onchange = handleWebFileSelect;
        document.body.appendChild(fileInput);
        fileInputRef.current = fileInput;
      }
    }

    return () => {
      if (Platform.OS === 'web' && fileInputRef.current) {
        document.body.removeChild(fileInputRef.current);
      }
    };
  }, []);

  const handleWebFileSelect = async (event: Event) => {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    
    if (file) {
      console.log('Web file selected (gallery or camera capture):', file.name);
      const imageUrl = URL.createObjectURL(file);
      console.log('Generated blob URL:', imageUrl);
      
      setLoading(true); 
      
      try {
        await processImage(imageUrl);
      } catch (error) {
        console.error('Error processing web image:', error);
        Alert.alert('오류', '웹에서 이미지를 처리하는 중 오류가 발생했습니다.');
      } finally {
        URL.revokeObjectURL(imageUrl);
        target.value = '';
        setLoading(false);
        setIsProcessing(false);
      }
    } else {
      setLoading(false);
    }
  };

  const handlePickFromGallery = async () => {
    console.log('Attempting to pick from gallery...');
    if (Platform.OS === 'web') {
      console.log('Using web file input for gallery...');
      if (fileInputRef.current) {
        fileInputRef.current.removeAttribute('capture');
        fileInputRef.current.click();
      } else {
        Alert.alert('오류', '파일 입력 요소를 찾을 수 없습니다.');
      }
      return;
    }

    // ===== 모바일 환경 개선된 갤러리 로직 =====
    try {
      setLoading(true);
      console.log('Starting mobile gallery selection...');
      
      // 권한 요청 및 확인
      console.log('Requesting media library permissions...');
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      console.log('Media library permission status:', status);
      
      if (status !== 'granted') {
        setLoading(false);
        Alert.alert(
          '권한 필요', 
          '갤러리 접근 권한이 필요합니다. 설정에서 권한을 허용해주세요.',
          [
            { text: '취소', style: 'cancel' },
            { 
              text: '설정', 
              onPress: () => {
                // iOS/Android에서 설정 앱으로 이도
                console.log('User should go to settings to enable gallery permissions');
              }
            }
          ]
        );
        return;
      }

      console.log('Gallery permission granted, launching image picker...');
      
      // 이미지 선택 옵션 최적화
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        base64: false,
        exif: false, // EXIF 데이터 제거로 용량 최적화
        allowsMultipleSelection: false, // 단일 선택만 허용
      });

      console.log('Image picker result:', {
        canceled: result.canceled,
        assetsCount: result.assets?.length || 0
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const selectedAsset = result.assets[0];
        console.log('Selected image details:', {
          uri: selectedAsset.uri,
          width: selectedAsset.width,
          height: selectedAsset.height,
          fileSize: selectedAsset.fileSize
        });
        
        // 파일 크기 검증 (10MB 제한)
        if (selectedAsset.fileSize && selectedAsset.fileSize > 10 * 1024 * 1024) {
          setLoading(false);
          Alert.alert(
            '파일 크기 초과',
            '선택한 이미지가 너무 큽니다. 10MB 이하의 이미지를 선택해주세요.',
            [
              { text: '다시 선택', onPress: () => handlePickFromGallery() },
              { text: '취소', style: 'cancel' }
            ]
          );
          return;
        }
        
        console.log('Processing selected image...');
        await processImage(selectedAsset.uri);
      } else {
        console.log('Image selection was canceled or no image selected');
        setLoading(false);
      }
    } catch (error: any) {
      console.error('Mobile gallery error:', error);
      
      // 상태 초기화
      setLoading(false);
      setIsProcessing(false);
      
      // 오류 종류에 따른 구체적인 메시지 제공
      let errorMessage = '갤러리에서 이미지를 선택하는데 실패했습니다.';
      
      if (error.message?.includes('permission') || error.message?.includes('Permission')) {
        errorMessage = '갤러리 접근 권한이 없습니다. 설정에서 권한을 허용해주세요.';
      } else if (error.message?.includes('cancelled') || error.message?.includes('canceled')) {
        console.log('User cancelled image selection');
        return; // 사용자가 취소한 경우는 오류 알림 표시하지 않음
      } else if (error.message?.includes('No such file')) {
        errorMessage = '선택한 파일을 찾을 수 없습니다. 다른 이미지를 선택해주세요.';
      }
      
      Alert.alert('갤러리 오류', errorMessage, [
        { text: '확인', style: 'default' },
        {
          text: '카메라 촬영',
          onPress: () => handleTakePhoto()
        }
      ]);
    }
  };

  const handleTakePhoto = async () => {
    console.log('Attempting to take photo...');
    if (Platform.OS === 'web') {
      // 웹 환경 처리 (기존 로직 유지)
      try {
        console.log('Trying to access camera stream...');
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' }
        });
        
        Alert.alert(
          '카메라 접근',
          '웹에서는 카메라 직접 촬영이 제한적입니다. 대신 파일을 선택하시겠습니까?',
          [
            { text: '취소', style: 'cancel' },
            {
              text: '파일 선택',
              onPress: () => {
                const cameraInput = document.createElement('input');
                cameraInput.type = 'file';
                cameraInput.accept = 'image/*';
                cameraInput.capture = 'environment';
                cameraInput.style.display = 'none';
                
                cameraInput.onchange = (event) => {
                  handleWebFileSelect(event);
                  document.body.removeChild(cameraInput);
                };
                
                document.body.appendChild(cameraInput);
                cameraInput.click();
              }
            }
          ]
        );
        
        stream.getTracks().forEach(track => track.stop());
        
      } catch (error) {
        console.log('Camera access failed, falling back to file input');
        Alert.alert(
          '카메라 접근 불가',
          '웹 브라우저에서 카메라에 접근할 수 없습니다. 파일을 선택하시겠습니까?',
          [
            { text: '취소', style: 'cancel' },
            {
              text: '파일 선택',
              onPress: () => {
                const cameraInput = document.createElement('input');
                cameraInput.type = 'file';
                cameraInput.accept = 'image/*';
                cameraInput.style.display = 'none';
                
                cameraInput.onchange = (event) => {
                  handleWebFileSelect(event);
                  document.body.removeChild(cameraInput);
                };
                
                document.body.appendChild(cameraInput);
                cameraInput.click();
              }
            }
          ]
        );
      }
      return;
    }

    // ===== 모바일 환경 개선된 카메라 로직 =====
    try {
      setLoading(true);
      console.log('Starting mobile camera capture...');
      
      // 카메라 레퍼런스 확인
      if (!cameraRef.current) {
        console.error('Camera reference is null');
        Alert.alert('카메라 오류', '카메라를 준비하는 중입니다. 잠시 후 다시 시도해주세요.');
        setLoading(false);
        return;
      }

      console.log('Taking picture with mobile camera...');
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: false,
        skipProcessing: false, // 이미지 처리 건너뛰지 않음
        exif: false, // EXIF 데이터 제거로 용량 최적화
      });
      
      console.log('Photo captured successfully:', {
        uri: photo?.uri,
        width: photo?.width,
        height: photo?.height
      });
      
      if (photo?.uri) {
        console.log('Processing captured photo...');
        await processImage(photo.uri);
      } else {
        console.error('No photo URI received from camera');
        Alert.alert('촬영 오류', '사진을 저장하지 못했습니다. 다시 시도해주세요.');
        setLoading(false);
      }
    } catch (error: any) {
      console.error('Mobile camera error:', error);
      
      // 상태 초기화
      setLoading(false);
      setIsProcessing(false);
      
      // 오류 종류에 따른 구체적인 메시지 제공
      let errorMessage = '사진 촬영에 실패했습니다.';
      
      if (error.message?.includes('permission')) {
        errorMessage = '카메라 권한이 필요합니다. 설정에서 권한을 허용해주세요.';
      } else if (error.message?.includes('busy')) {
        errorMessage = '카메라가 사용 중입니다. 잠시 후 다시 시도해주세요.';
      } else if (error.message?.includes('not available')) {
        errorMessage = '카메라를 사용할 수 없습니다. 갤러리에서 사진을 선택해주세요.';
      }
      
      Alert.alert('촬영 실패', errorMessage, [
        { text: '확인', style: 'default' },
        {
          text: '갤러리 선택',
          onPress: () => handlePickFromGallery()
        }
      ]);
    }
  };

  const handleClose = () => {
    // 진행 중인 작업 취소
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    // 상태 초기화
    resetStates();
    router.back();
  };

  const toggleCameraFacing = () => {
    setFacing(current => (current === 'back' ? 'front' : 'back'));
  };

  const processImage = async (imageUri: string) => {
    // 중복 처리 방지
    if (isProcessing) {
      console.log('OCR processing already in progress, ignoring request');
      return;
    }

    try {
      setIsProcessing(true);
      setLoading(true);
      
      console.log('=== Starting OCR Processing ===');
      console.log('Image URI:', imageUri);
      
      // 컴포넌트가 언마운트되었는지 확인
      if (!mountedRef.current) {
        console.log('Component unmounted, aborting OCR');
        return;
      }
      
      // 이미지 URI 유효성 검사 강화
      if (!imageUri || typeof imageUri !== 'string') {
        throw new Error('유효하지 않은 이미지 URI입니다.');
      }
      
      // 이미지 URI 형식 검증
      if (!imageUri.includes('file://') && !imageUri.includes('blob:') && !imageUri.includes('http')) {
        throw new Error('지원되지 않는 이미지 형식입니다.');
      }
      
      console.log('Validating OCR service...');
      
      // OCR 처리 시작
      console.log('Calling processImageWithClovaOCR...');
      const result: OCRResult = await processImageWithClovaOCR(imageUri);
      
      // 컴포넌트가 아직 마운트되어 있는지 확인
      if (!mountedRef.current) {
        console.log('Component unmounted during OCR, discarding result');
        return;
      }
      
      console.log('=== OCR Processing Completed ===');
      console.log('OCR Result:', JSON.stringify(result, null, 2));
      
      setLoading(false);
      setIsProcessing(false);
      setOcrResult(result);
      setShowOcrResult(true);
      
    } catch (error: any) {
      console.error('=== OCR Processing Error ===');
      console.error('Error details:', error);
      console.error('Error message:', error.message);
      
      // 컴포넌트가 언마운트된 경우 UI 업데이트 하지 않음
      if (!mountedRef.current) {
        console.log('Component unmounted, not showing error');
        return;
      }
      
      setLoading(false);
      setIsProcessing(false);
      
      // 사용자가 취소한 경우는 에러로 처리하지 않음
      if (error.name === 'AbortError' || error.message?.includes('aborted')) {
        console.log('OCR request was aborted');
        return;
      }
      
      // 오류 종류에 따른 구체적인 메시지 제공
      let errorTitle = 'OCR 처리 실패';
      let errorMessage = 'OCR 처리 중 오류가 발생했습니다.';
      
      if (error.message?.includes('CORS')) {
        errorTitle = '네트워크 오류';
        errorMessage = '웹에서는 OCR 기능이 제한됩니다. 모바일 앱에서 사용해주세요.';
      } else if (error.message?.includes('네트워크') || error.message?.includes('Failed to fetch')) {
        errorTitle = '네트워크 연결 오류';
        errorMessage = '인터넷 연결을 확인하고 다시 시도해주세요.';
      } else if (error.message?.includes('API')) {
        errorTitle = 'API 오류';
        errorMessage = 'OCR 서비스에 일시적인 문제가 있습니다. 잠시 후 다시 시도해주세요.';
      } else if (error.message?.includes('권한')) {
        errorTitle = '권한 오류';
        errorMessage = 'OCR 서비스 접근 권한이 없습니다. 설정을 확인해주세요.';
      } else if (error.message?.includes('timeout') || error.message?.includes('초과')) {
        errorTitle = '시간 초과';
        errorMessage = '처리 시간이 초과되었습니다. 네트워크 상태를 확인하고 다시 시도해주세요.';
      } else {
        errorMessage = error.message || errorMessage;
      }
      
      Alert.alert(
        errorTitle, 
        errorMessage,
        [
          { text: '취소', style: 'cancel' },
          { 
            text: '다시 시도', 
            onPress: () => {
              console.log('User chose to retry OCR');
              // 상태 초기화 후 다시 시도 가능하도록
              resetStates();
            }
          },
          {
            text: '수동 입력',
            style: 'default',
            onPress: () => {
              console.log('User chose manual input due to OCR failure');
              if (mountedRef.current) {
                router.replace({
                  pathname: '/expense/detail',
                  params: { 
                    tripId, 
                    tripName,
                    ocrAmount: '',
                    ocrDescription: '',
                    ocrError: 'true'
                  }
                });
              }
            }
          }
        ]
      );
    }
  };

  // OCR 결과 적용하기 (기존 기능)
  const applyOcrResult = () => {
    if (!ocrResult || buttonDisabled) return;
    
    setButtonDisabled(true);
    
    const amount = ocrResult.amount ? String(ocrResult.amount).trim() : '';
    const description = ocrResult.description ? String(ocrResult.description).trim() : '';
    const confidence = ocrResult.confidence || 0;
    
    console.log('Applying OCR result...');
    console.log('Amount:', amount);
    console.log('Description:', description);
    
    setShowOcrResult(false);
    
    // 컴포넌트가 마운트된 상태에서만 네비게이션 실행
    if (mountedRef.current) {
      router.replace({
        pathname: '/expense/detail',
        params: { 
          tripId, 
          tripName,
          ocrAmount: amount,
          ocrDescription: description,
          ocrConfidence: confidence.toString()
        }
      });
    }
  };

  // 선택하기 버튼 클릭 (새로운 기능)
  const openNumberSelector = () => {
    if (buttonDisabled) return;
    
    // 후보 숫자가 없는 경우 경고 메시지
    if (!ocrResult?.candidateNumbers || ocrResult.candidateNumbers.length === 0) {
      Alert.alert(
        '숫자 선택 불가',
        '인식된 후보 숫자가 없습니다. 적용하기를 사용하거나 수동으로 입력해주세요.',
        [
          { text: '확인', style: 'default' },
          {
            text: '수동 입력',
            onPress: () => {
              if (mountedRef.current) {
                setShowOcrResult(false);
                router.replace({
                  pathname: '/expense/detail',
                  params: { 
                    tripId, 
                    tripName,
                    ocrAmount: '',
                    ocrDescription: ocrResult?.description || '',
                    ocrError: 'manual'
                  }
                });
              }
            }
          }
        ]
      );
      return;
    }
    
    setShowOcrResult(false);
    setShowNumberSelector(true);
  };

  // 숫자 선택 완료
  const selectNumber = (selectedNumber: string) => {
    if (!ocrResult || buttonDisabled) return;
    
    setButtonDisabled(true);
    
    console.log('Selected number:', selectedNumber);
    
    const description = ocrResult.description ? String(ocrResult.description).trim() : '';
    const confidence = ocrResult.confidence || 0;
    
    setShowNumberSelector(false);
    
    // 컴포넌트가 마운트된 상태에서만 네비게이션 실행
    if (mountedRef.current) {
      router.replace({
        pathname: '/expense/detail',
        params: { 
          tripId, 
          tripName,
          ocrAmount: selectedNumber,
          ocrDescription: description,
          ocrConfidence: confidence.toString()
        }
      });
    }
  };

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      // 진행 중인 OCR 요청 취소
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      // 웹 환경의 파일 input 정리
      if (Platform.OS === 'web' && fileInputRef.current) {
        try {
          document.body.removeChild(fileInputRef.current);
        } catch (e) {
          // 이미 제거된 경우 무시
        }
      }
    };
  }, []);

  // 모달이 닫힐 때 버튼 상태 초기화
  useEffect(() => {
    if (!showOcrResult && !showNumberSelector) {
      setButtonDisabled(false);
    }
  }, [showOcrResult, showNumberSelector]);

  // 상태 초기화 함수
  const resetStates = () => {
    setIsProcessing(false);
    setLoading(false);
    setButtonDisabled(false);
    setOcrResult(null);
    setShowOcrResult(false);
    setShowNumberSelector(false);
  };

  if (!permission && Platform.OS !== 'web') {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color="#4A90E2" />
        <Text style={styles.statusText}>카메라 권한을 확인하는 중...</Text>
      </View>
    );
  }

  if (!permission?.granted && Platform.OS !== 'web') {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Ionicons name="camera-outline" size={80} color="#ccc" />
        <Text style={styles.noPermissionText}>카메라 접근 권한이 필요합니다</Text>
        <Text style={styles.permissionDescription}>
          영수증을 스캔하여 자동으로 금액을 입력받으려면 카메라 권한이 필요합니다.
        </Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.permissionButtonText}>권한 요청</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.tripInfo}>
          <View style={styles.tripIcon}>
            <Ionicons name="airplane" size={20} color="white" />
          </View>
          <Text style={styles.tripName}>{tripName || '여행'}</Text>
        </View>
        <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
          <Ionicons name="close" size={24} color="#333" />
        </TouchableOpacity>
      </View>

      <View style={styles.cameraContainer}>
        <Text style={styles.title}>영수증/거래내역을 스캔해주세요</Text>
        
        <View style={styles.cameraWrapper}>
          {Platform.OS === 'web' ? (
            <View style={styles.webCameraPlaceholder}>
              <Ionicons name="camera-outline" size={80} color="#ccc" />
              <Text style={styles.webPlaceholderText}>카메라 미리보기</Text>
            </View>
          ) : (
            <CameraView
              ref={cameraRef}
              style={styles.camera}
              facing={facing}
            />
          )}
          
          {loading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#4A90E2" />
              <Text style={styles.loadingText}>처리 중...</Text>
            </View>
          )}
          
          {Platform.OS !== 'web' && (
            <View style={styles.cameraOverlay}>
              <View style={styles.scanFrame} />
              <Text style={styles.scanText}>영수증을 프레임 안에 맞춰주세요</Text>
            </View>
          )}
        </View>

        <View style={styles.controls}>
          <TouchableOpacity 
            style={[styles.controlButton, (loading || isProcessing) && styles.buttonDisabled]} 
            onPress={handlePickFromGallery}
            disabled={loading || isProcessing}
          >
            <Ionicons name="images" size={24} color="#4A90E2" />
            <Text style={styles.controlButtonText}>
              {Platform.OS === 'web' ? '갤러리' : '갤러리'}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.captureButton, (loading || isProcessing) && styles.captureButtonDisabled]} 
            onPress={handleTakePhoto}
            disabled={loading || isProcessing}
          >
            <Ionicons name="camera" size={32} color="white" />
          </TouchableOpacity>
          
          {Platform.OS !== 'web' && (
            <TouchableOpacity 
              style={styles.controlButton} 
              onPress={toggleCameraFacing}
              disabled={loading}
            >
              <Ionicons name="camera-reverse" size={24} color="#4A90E2" />
              <Text style={styles.controlButtonText}>전환</Text>
            </TouchableOpacity>
          )}
          
          {Platform.OS === 'web' && (
            <TouchableOpacity 
              style={styles.controlButton} 
              onPress={() => {
                router.replace({
                  pathname: '/expense/detail',
                  params: { 
                    tripId, 
                    tripName,
                    ocrAmount: '',
                    ocrDescription: ''
                  }
                });
              }}
              disabled={loading}
            >
              <Ionicons name="create-outline" size={24} color="#4A90E2" />
              <Text style={styles.controlButtonText}>수동 입력</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* OCR 결과 모달 */}
      <Modal
        visible={showOcrResult}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowOcrResult(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>📋 OCR 처리 완료</Text>
              <TouchableOpacity 
                onPress={() => setShowOcrResult(false)}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalContent}>
              <View style={styles.resultSection}>
                <Text style={styles.resultLabel}>💰 인식된 금액</Text>
                <Text style={styles.resultValue}>
                  {ocrResult?.amount || '인식 실패'}
                </Text>
              </View>
              
              <View style={styles.resultSection}>
                <Text style={styles.resultLabel}>🏪 상점/설명</Text>
                <Text style={styles.resultValue}>
                  {ocrResult?.description || '인식 실패'}
                </Text>
              </View>
              
              <View style={styles.resultSection}>
                <Text style={styles.resultLabel}>📊 신뢰도</Text>
                <Text style={styles.resultValue}>
                  {ocrResult?.confidence ? Math.round(ocrResult.confidence * 100) + '%' : '알 수 없음'}
                </Text>
              </View>
              
              {ocrResult?.candidateNumbers && ocrResult.candidateNumbers.length > 0 && (
                <View style={styles.resultSection}>
                  <Text style={styles.resultLabel}>🔢 인식된 후보 숫자들</Text>
                  <Text style={styles.candidatePreview}>
                    {ocrResult.candidateNumbers.slice(0, 3).join(', ')}
                    {ocrResult.candidateNumbers.length > 3 && '...'}
                  </Text>
                </View>
              )}
            </ScrollView>
            
            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={[styles.primaryButton, buttonDisabled && styles.buttonDisabled]}
                onPress={openNumberSelector}
                disabled={buttonDisabled}
              >
                <Text style={[styles.primaryButtonText, buttonDisabled && styles.buttonDisabledText]}>선택하기</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.primaryButton, buttonDisabled && styles.buttonDisabled]}
                onPress={applyOcrResult}
                disabled={buttonDisabled}
              >
                <Text style={[styles.primaryButtonText, buttonDisabled && styles.buttonDisabledText]}>적용하기</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 숫자 선택 모달 */}
      <Modal
        visible={showNumberSelector}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowNumberSelector(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>🔢 금액 선택</Text>
              <TouchableOpacity 
                onPress={() => {
                  setButtonDisabled(false);
                  setShowNumberSelector(false);
                }}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.selectorDescription}>
              영수증에서 인식된 숫자들 중 총금액에 해당하는 숫자를 선택해주세요
            </Text>
            
            <ScrollView style={styles.numberList}>
              {ocrResult?.candidateNumbers?.map((number, index) => (
                <TouchableOpacity
                  key={index}
                  style={[styles.numberItem, buttonDisabled && styles.buttonDisabled]}
                  onPress={() => selectNumber(number)}
                  disabled={buttonDisabled}
                >
                  <Text style={[styles.numberText, buttonDisabled && styles.buttonDisabledText]}>{number}</Text>
                  <Text style={[styles.numberUnit, buttonDisabled && styles.buttonDisabledText]}>
                    {parseFloat(number.replace(/,/g, '')) >= 1000 ? '원' : '$'}
                  </Text>
                </TouchableOpacity>
              ))}
              
              {(!ocrResult?.candidateNumbers || ocrResult.candidateNumbers.length === 0) && (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>인식된 숫자가 없습니다</Text>
                  <Text style={styles.emptySubText}>수동으로 입력해주세요</Text>
                </View>
              )}
            </ScrollView>
            
            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={styles.secondaryButton}
                onPress={() => {
                  setButtonDisabled(false);
                  setShowNumberSelector(false);
                  setShowOcrResult(true);
                }}
              >
                <Text style={styles.secondaryButtonText}>뒤로</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.secondaryButton}
                onPress={() => {
                  setShowNumberSelector(false);
                  router.replace({
                    pathname: '/expense/detail',
                    params: { 
                      tripId, 
                      tripName,
                      ocrAmount: '',
                      ocrDescription: ocrResult?.description || '',
                      ocrError: 'manual'
                    }
                  });
                }}
              >
                <Text style={styles.secondaryButtonText}>수동 입력</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
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
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  tripInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  tripIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#4A90E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  tripName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  closeButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraContainer: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 40,
  },
  cameraWrapper: {
    width: '100%',
    height: 300,
    backgroundColor: 'white',
    borderRadius: 12,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  camera: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
    marginTop: 20,
  },
  cameraOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanFrame: {
    width: '70%',
    height: '70%',
    borderWidth: 3,
    borderColor: '#4A90E2',
    borderRadius: 8,
    borderStyle: 'solid',
  },
  scanText: {
    fontSize: 14,
    color: 'white',
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
  },
  controls: {
    flexDirection: 'row',
    gap: 20,
  },
  controlButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#4A90E2',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  controlButtonText: {
    fontSize: 16,
    color: '#4A90E2',
    fontWeight: '500',
    marginLeft: 8,
  },
  captureButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#4A90E2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButtonDisabled: {
    backgroundColor: '#E5E5E5',
  },
  noPermissionText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 20,
    textAlign: 'center',
  },
  permissionButton: {
    backgroundColor: '#4A90E2',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 20,
  },
  permissionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  statusText: {
    fontSize: 16,
    color: '#666',
    marginTop: 20,
  },
  permissionDescription: {
    fontSize: 14,
    color: '#666',
    marginTop: 10,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  webCameraPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  webCameraText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#666',
    marginTop: 20,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  webPlaceholderText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#666',
    marginTop: 20,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  
  // 모달 스타일
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    minHeight: '50%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
  },
  
  // OCR 결과 스타일
  resultSection: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  resultLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    marginBottom: 8,
  },
  resultValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  candidatePreview: {
    fontSize: 14,
    color: '#4A90E2',
    fontStyle: 'italic',
  },
  
  // 버튼 스타일
  primaryButton: {
    flex: 1,
    backgroundColor: '#4A90E2',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: 'white',
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '500',
  },
  
  // 숫자 선택 스타일
  selectorDescription: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    lineHeight: 20,
  },
  numberList: {
    flex: 1,
    paddingHorizontal: 20,
  },
  numberItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginVertical: 4,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  numberText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  numberUnit: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#999',
    marginBottom: 8,
  },
  emptySubText: {
    fontSize: 14,
    color: '#CCC',
  },
  
  // 버튼 disabled 스타일
  buttonDisabled: {
    backgroundColor: '#E5E5E5',
    opacity: 0.6,
  },
  buttonDisabledText: {
    color: '#999',
  },
}); 