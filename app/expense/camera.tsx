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
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system';
import { Link } from 'expo-router';
import * as Linking from 'expo-linking';
import { processImageWithClovaOCR, OCRResult, ExpenseItem } from '../../services/ocrService';
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
  
  // 다중 선택 관련 상태 추가
  const [selectedExpenseItems, setSelectedExpenseItems] = useState<Set<number>>(new Set());
  const [totalSelectedAmount, setTotalSelectedAmount] = useState<number>(0);
  
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

  // ===== MediaLibrary를 사용한 개선된 갤러리 접근 =====
  const safePickFromGalleryWithMediaLibrary = async () => {
    // 이미 처리 중인 경우 중복 실행 방지
    if (isProcessing || loading) {
      console.log('Gallery access already in progress, skipping...');
      return;
    }

    try {
      setLoading(true);
      setIsProcessing(true);
      console.log('Starting MediaLibrary gallery selection...');
      
      // MediaLibrary 권한 확인 및 요청
      const { status: currentStatus } = await MediaLibrary.getPermissionsAsync();
      console.log('Current MediaLibrary permission status:', currentStatus);
      
      let finalStatus = currentStatus;
      
      if (currentStatus !== 'granted') {
        console.log('Requesting MediaLibrary permissions...');
        const { status: requestedStatus } = await MediaLibrary.requestPermissionsAsync();
        console.log('Requested MediaLibrary permission status:', requestedStatus);
        finalStatus = requestedStatus;
      }
      
      if (finalStatus !== 'granted') {
        setLoading(false);
        setIsProcessing(false);
        
        const message = Platform.OS === 'ios' 
          ? '갤러리 접근이 거부되었습니다. 설정에서 "모든 사진" 또는 "선택한 사진"을 허용해주세요.'
          : '갤러리 접근이 거부되었습니다. 앱 설정에서 권한을 허용해주세요.';
          
        Alert.alert(
          '권한 필요', 
          message,
          [
            { text: '취소', style: 'cancel' },
            { 
              text: '설정으로 이동', 
              onPress: async () => {
                try {
                  if (Platform.OS === 'ios') {
                    await Linking.openURL('app-settings:');
                  } else {
                    await Linking.openSettings();
                  }
                } catch (linkingError) {
                  console.log('Could not open settings:', linkingError);
                  Alert.alert('설정 열기 실패', '수동으로 설정에서 권한을 허용해주세요.');
                }
              }
            }
          ]
        );
        return;
      }

      // MediaLibrary로 최신 사진들 가져오기 (최근 100개)
      console.log('Fetching photos from MediaLibrary...');
      const assets = await MediaLibrary.getAssetsAsync({
        first: 100,
        mediaType: 'photo',
        sortBy: 'creationTime',
      });

      console.log(`Found ${assets.assets.length} photos in gallery`);
        
      if (assets.assets.length === 0) {
          setLoading(false);
        setIsProcessing(false);
        Alert.alert('갤러리 비어있음', '갤러리에 사진이 없습니다.');
        return;
      }

      // iOS에서 Limited Photos Library 체크
      if (Platform.OS === 'ios' && assets.hasNextPage) {
        console.log('iOS Limited Photos Library detected, showing selection UI...');
        
        // 사용자에게 더 많은 사진 선택을 유도
          Alert.alert(
          '사진 선택',
          '현재 선택된 사진만 접근 가능합니다. 더 많은 사진을 선택하시겠습니까?',
            [
            { text: '현재 사진 사용', onPress: () => showPhotoSelector(assets.assets) },
            { 
              text: '더 많은 사진 선택', 
              onPress: async () => {
                try {
                  // iOS에서 사진 선택 UI 열기
                  await MediaLibrary.presentPermissionsPickerAsync();
                  
                  // 사진 선택 후 새로운 목록 가져오기
                  console.log('Refetching photos after user selection...');
                  const updatedAssets = await MediaLibrary.getAssetsAsync({
                    first: 100,
                    mediaType: 'photo',
                    sortBy: 'creationTime',
                  });
                  
                  console.log(`Updated photo count: ${updatedAssets.assets.length}`);
                  showPhotoSelector(updatedAssets.assets);
                } catch (error) {
                  console.error('Error presenting permissions picker:', error);
                  showPhotoSelector(assets.assets);
                }
              }
            }
          ]
        );
      } else {
        // 일반적인 경우 바로 사진 선택 UI 표시
        showPhotoSelector(assets.assets);
      }

    } catch (error: any) {
      console.error('MediaLibrary gallery error:', error);
      setLoading(false);
      setIsProcessing(false);
      
      // MediaLibrary 실패 시 기존 ImagePicker로 fallback
      console.log('Falling back to ImagePicker...');
      safePickFromGallery();
    }
  };

  // 사진 선택 UI 표시
  const showPhotoSelector = (photos: MediaLibrary.Asset[]) => {
    // 간단히 첫 번째 사진을 선택하거나, 나중에 커스텀 UI로 확장 가능
    if (photos.length > 0) {
      console.log('Auto-selecting first available photo for now');
      processImage(photos[0].uri);
    } else {
      setLoading(false);
      setIsProcessing(false);
      Alert.alert('사진 없음', '사용 가능한 사진이 없습니다.');
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
      // 에러 리포팅
      reportError('Camera Capture', error);
      
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
          onPress: () => safePickFromGalleryWithMediaLibrary()
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
      console.log('Image URI type:', typeof imageUri);
      console.log('Image URI length:', imageUri.length);
      console.log('Platform:', Platform.OS);
      
      // 컴포넌트가 언마운트되었는지 확인
      if (!mountedRef.current) {
        console.log('Component unmounted, aborting OCR');
        return;
      }
      
      // 이미지 URI 유효성 검사 강화
      if (!imageUri || typeof imageUri !== 'string') {
        throw new Error('유효하지 않은 이미지 URI입니다.');
      }
      
      // iOS 전용 이미지 URI 형식 검증 및 전처리
      if (Platform.OS === 'ios') {
        console.log('iOS image processing...');
        
        // iOS HEIC 형식 재검사 (processImage 레벨에서)
        if (imageUri.includes('.heic') || imageUri.includes('.HEIC')) {
          console.log('HEIC format detected in processImage, this may cause OCR issues');
          // HEIC가 여기까지 왔다면 경고만 표시
        }
        
        // iOS의 assets-library:// 형식 처리
        if (imageUri.startsWith('assets-library://')) {
          console.log('iOS assets-library URI detected');
        }
        
        // iOS의 file:// 형식 처리
        if (imageUri.startsWith('file://')) {
          console.log('iOS file URI detected');
          
          // 파일 존재 여부 확인
          try {
            const fileInfo = await FileSystem.getInfoAsync(imageUri);
            console.log('iOS file info:', fileInfo);
            
            if (!fileInfo.exists) {
              throw new Error('iOS에서 선택한 파일을 찾을 수 없습니다. iCloud 사진이나 최적화된 저장소 설정을 확인해주세요.');
            }
            
            // 파일 크기 재확인
            if (fileInfo.size && fileInfo.size > 52428800) { // 50MB
              throw new Error(`이미지 파일이 너무 큽니다. 크기: ${(fileInfo.size / 1024 / 1024).toFixed(1)}MB (최대: 50MB)`);
            }
          } catch (fileError) {
            console.error('iOS file validation error:', fileError);
            // 파일 접근 오류 시 더 구체적인 안내
            if (fileError.message?.includes('not found') || fileError.message?.includes('찾을 수 없습니다')) {
              throw new Error('선택한 이미지에 접근할 수 없습니다. iCloud 사진 다운로드 상태를 확인하거나 다른 이미지를 선택해주세요.');
            }
            throw fileError;
          }
        }
      }
      
      // 이미지 URI 형식 검증 (iOS 형식 추가)
      const validUriFormats = [
        'file://', 'blob:', 'http', 'https://', 'content://', 'assets-library://', 'ph://'
      ];
      
      const isValidUri = validUriFormats.some(format => imageUri.includes(format));
      
      if (!isValidUri) {
        console.warn('Unusual image URI format:', imageUri);
        console.warn('Expected formats:', validUriFormats.join(', '));
        // iOS에서는 경고만 표시하고 계속 진행
        if (Platform.OS === 'ios') {
          console.log('Proceeding with unusual iOS URI format...');
        }
      }
      
      console.log('Validating OCR service...');
      
      // 전처리 완료 후 AbortController 설정
      abortControllerRef.current = new AbortController();
      
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
      // 에러 리포팅
      reportError('OCR Processing', error);
      
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
      
      // iOS 전용 에러 처리
      if (Platform.OS === 'ios') {
        // HEIC 관련 오류
        if (error.message?.includes('HEIC') || error.message?.includes('heic')) {
          Alert.alert(
            'HEIC 형식 문제',
            'HEIC 형식 이미지 처리에 실패했습니다. iPhone 설정에서 "호환성 우선" 모드를 사용하거나 다른 이미지를 선택해주세요.',
            [
              { text: '확인' },
              { 
                text: '설정 방법 보기', 
                onPress: () => {
                  Alert.alert(
                    '카메라 형식 변경',
                    '설정 > 카메라 > 형식 > "호환성 우선" 선택\n\n※ 이후 촬영되는 사진이 JPEG 형식으로 저장됩니다.'
                  );
                }
              }
            ]
          );
          return;
        }
        
        // iCloud 사진 관련 오류
        if (error.message?.includes('iCloud') || error.message?.includes('optimized')) {
          Alert.alert(
            'iCloud 사진 오류',
            'iCloud 사진 다운로드에 실패했습니다. WiFi 연결을 확인하거나 로컬에 저장된 다른 이미지를 선택해주세요.',
            [
              { text: '확인' },
              { 
                text: 'iCloud 설정', 
                onPress: () => {
                  Alert.alert(
                    'iCloud 사진 설정',
                    '설정 > [사용자명] > iCloud > 사진\n\n"iPhone 저장 공간 최적화"가 켜져 있으면 일부 사진이 클라우드에만 저장될 수 있습니다.'
                  );
                }
              }
            ]
          );
          return;
        }
        
        // 파일 접근 권한 오류
        if (error.message?.includes('Permission denied') || error.message?.includes('접근할 수 없습니다')) {
          Alert.alert(
            'iOS 파일 접근 오류',
            '선택한 이미지에 접근할 수 없습니다. 사진 앱에서 직접 이미지를 확인하거나 다른 이미지를 선택해주세요.',
            [
              { text: '확인' },
              { 
                text: '사진 권한 확인', 
                onPress: () => Linking.openURL('app-settings:') 
              }
            ]
          );
          return;
        }
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
      } else if (error.message?.includes('크기') || error.message?.includes('size')) {
        errorTitle = '이미지 크기 오류';
        errorMessage = error.message; // 크기 관련 에러는 그대로 전달
      } else if (error.message?.includes('형식') || error.message?.includes('format')) {
        errorTitle = '이미지 형식 오류';
        errorMessage = error.message; // 형식 관련 에러는 그대로 전달
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
    
    // 지출 항목들이 있는 경우 지출 항목 선택기 표시
    if (ocrResult?.expenseItems && ocrResult.expenseItems.length > 0) {
      console.log('Opening expense item selector with', ocrResult.expenseItems.length, 'items');
      setShowNumberSelector(true);
      return;
    }
    
    // 지출 항목이 없고 후보 숫자가 있는 경우 기존 숫자 선택기 표시
    if (ocrResult?.candidateNumbers && ocrResult.candidateNumbers.length > 0) {
      console.log('Opening number selector with', ocrResult.candidateNumbers.length, 'numbers');
      setShowNumberSelector(true);
      return;
    }
    
    // 둘 다 없는 경우 경고 메시지
    Alert.alert(
      '선택 불가',
      '인식된 지출 항목이나 숫자가 없습니다. 적용하기를 사용하거나 수동으로 입력해주세요.',
      [{ text: '확인' }]
    );
  };

  // 지출 항목 토글 선택 (다중 선택 지원)
  const toggleExpenseItem = (index: number) => {
    if (buttonDisabled || !ocrResult?.expenseItems) return;
    
    const newSelected = new Set(selectedExpenseItems);
    
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    
    setSelectedExpenseItems(newSelected);
    
    // 선택된 항목들의 총액 계산
    let total = 0;
    newSelected.forEach(itemIndex => {
      const item = ocrResult.expenseItems![itemIndex];
      if (item && item.amount) {
        // 금액에서 숫자만 추출하여 합산
        const numericAmount = parseFloat(item.amount.replace(/[^0-9.]/g, ''));
        if (!isNaN(numericAmount)) {
          total += numericAmount;
        }
      }
    });
    
    setTotalSelectedAmount(total);
    console.log('Selected items:', Array.from(newSelected), 'Total amount:', total);
  };

  // 선택된 지출 항목들 적용
  const applySelectedExpenseItems = () => {
    if (buttonDisabled || selectedExpenseItems.size === 0 || !ocrResult?.expenseItems) {
      Alert.alert('선택 오류', '적용할 항목을 선택해주세요.');
      return;
    }
    
    setButtonDisabled(true);
    
    // 선택된 항목들의 설명을 조합
    const selectedItems = Array.from(selectedExpenseItems).map(index => 
      ocrResult.expenseItems![index]
    );
    
    const combinedDescription = selectedItems
      .map(item => item.description)
      .join(', ');
    
    const formattedAmount = totalSelectedAmount.toLocaleString();
    
    console.log('Applying selected expense items:', {
      amount: formattedAmount,
      description: combinedDescription,
      selectedCount: selectedItems.length
    });
    
    setShowNumberSelector(false);
    
    // 컴포넌트가 마운트된 상태에서만 네비게이션 실행
    if (mountedRef.current) {
      router.replace({
        pathname: '/expense/detail',
        params: { 
          tripId, 
          tripName,
          ocrAmount: formattedAmount,
          ocrDescription: combinedDescription,
          ocrConfidence: (selectedItems.reduce((acc, item) => acc + (item.confidence || 0.8), 0) / selectedItems.length).toString()
        }
      });
    }
  };

  // 지출 항목 선택 (단일 선택 - 호환성 유지)
  const selectExpenseItem = (selectedItem: ExpenseItem) => {
    if (buttonDisabled) return;
    
    setButtonDisabled(true);
    
    console.log('Selected expense item:', selectedItem);
    
    setShowNumberSelector(false);
    
    // 컴포넌트가 마운트된 상태에서만 네비게이션 실행
    if (mountedRef.current) {
      router.replace({
        pathname: '/expense/detail',
        params: { 
          tripId, 
          tripName,
          ocrAmount: selectedItem.amount,
          ocrDescription: selectedItem.description,
          ocrConfidence: (selectedItem.confidence || 0.8).toString()
        }
      });
    }
  };

  // 숫자 선택 (기존 기능 - fallback용)
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
    setSelectedExpenseItems(new Set());
    setTotalSelectedAmount(0);
  };

  // 디바이스 정보 수집 (디버깅용)
  const getDeviceInfo = () => {
    try {
      const Constants = require('expo-constants');
      return {
        platform: Platform.OS,
        version: Platform.Version,
        deviceName: Constants.deviceName || 'Unknown',
        appVersion: Constants.expoConfig?.version || 'Unknown',
        systemVersion: Constants.systemVersion || 'Unknown'
      };
    } catch (error) {
      console.error('Failed to get device info:', error);
      return {
        platform: Platform.OS,
        version: Platform.Version,
        deviceName: 'Unknown',
        appVersion: 'Unknown',
        systemVersion: 'Unknown'
      };
    }
  };

  // 에러 리포팅 (개발 모드에서 상세 정보 제공)
  const reportError = (context: string, error: any) => {
    const deviceInfo = getDeviceInfo();
    const errorReport = {
      context,
      timestamp: new Date().toISOString(),
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      },
      deviceInfo,
      appState: {
        loading,
        isProcessing,
        buttonDisabled,
        showOcrResult,
        showNumberSelector
      }
    };
    
    console.error('=== Error Report ===');
    console.error(JSON.stringify(errorReport, null, 2));
    
    // 개발 모드에서는 더 상세한 정보 제공
    if (__DEV__) {
      console.error('Full error object:', error);
    }
    
    return errorReport;
  };

  // 기존 ImagePicker 방식 (Fallback용)
  const safePickFromGallery = async () => {
    try {
      await handlePickFromGallery();
    } catch (error) {
      console.error('Safe gallery wrapper caught error:', error);
      Alert.alert(
        '갤러리 접근 실패',
        '갤러리에 접근할 수 없습니다. 카메라로 직접 촬영하시겠습니까?',
        [
          { text: '취소', style: 'cancel' },
          { text: '카메라 촬영', onPress: () => handleTakePhoto() }
        ]
      );
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

    try {
      setLoading(true);
      setIsProcessing(true);
      
      // iOS 전용 개선된 갤러리 옵션
      const pickerOptions: ImagePicker.ImagePickerOptions = {
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: Platform.OS === 'ios' ? 0.9 : 0.8, // iOS에서 더 높은 품질 유지
        base64: false,
        allowsMultipleSelection: false,
        // iOS 전용 옵션들
        ...(Platform.OS === 'ios' && {
          // HEIC 형식을 JPEG로 자동 변환
          videoQuality: ImagePicker.UIImagePickerControllerQualityType.High,
          // 편집 옵션 비활성화로 원본 유지
          allowsEditing: false,
        }),
      };

      console.log('Launching image library with iOS-optimized options...');
      console.log('Picker options:', JSON.stringify(pickerOptions, null, 2));
      
      const result = await ImagePicker.launchImageLibraryAsync(pickerOptions);

      console.log('=== Image Picker Result ===');
      console.log('Cancelled:', result.canceled);
      console.log('Assets count:', result.assets?.length || 0);

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const selectedImageUri = asset.uri;
        
        console.log('=== Gallery Image Selected ===');
        console.log('Image URI:', selectedImageUri);
        console.log('Image width:', asset.width);
        console.log('Image height:', asset.height);
        console.log('File size:', asset.fileSize || 'Unknown');
        console.log('File type:', asset.type || 'Unknown');
        console.log('EXIF data:', asset.exif || 'None');
        
        // iOS HEIC 형식 감지 및 변환 체크
        if (Platform.OS === 'ios' && selectedImageUri.includes('.heic') || selectedImageUri.includes('.HEIC')) {
          console.log('HEIC format detected, checking conversion...');
          
          // HEIC 파일인 경우 추가 처리 필요
          Alert.alert(
            'HEIC 형식 감지',
            '이 이미지는 HEIC 형식입니다. OCR 처리를 위해 JPEG로 변환합니다.',
            [
              { 
                text: '변환 후 처리', 
                onPress: async () => {
                  try {
                    console.log('Converting HEIC to JPEG...');
                    
                    // ImagePicker의 allowsEditing 옵션으로 자동 변환 시도
                    const convertResult = await ImagePicker.launchImageLibraryAsync({
                      ...pickerOptions,
                      allowsEditing: true, // 편집 모드로 JPEG 변환 유도
                      quality: 0.8,
                    });
                    
                    if (!convertResult.canceled && convertResult.assets && convertResult.assets.length > 0) {
                      console.log('HEIC conversion successful, processing converted image...');
                      await processImage(convertResult.assets[0].uri);
                    } else {
                      console.log('HEIC conversion failed, trying original...');
                      await processImage(selectedImageUri);
                    }
                  } catch (conversionError) {
                    console.error('HEIC conversion error:', conversionError);
                    // 변환 실패 시 원본으로 시도
                    await processImage(selectedImageUri);
                  }
                }
              },
              { 
                text: '원본으로 시도', 
                onPress: () => processImage(selectedImageUri) 
              }
            ]
          );
          return;
        }
        
        // 이미지 크기 검증 (iOS에서 대용량 이미지 처리)
        const fileSizeMB = asset.fileSize ? asset.fileSize / (1024 * 1024) : 0;
        const imagePixels = asset.width && asset.height ? asset.width * asset.height : 0;
        
        console.log('Image analysis:');
        console.log('- File size:', fileSizeMB.toFixed(2), 'MB');
        console.log('- Resolution:', `${asset.width}x${asset.height}`);
        console.log('- Total pixels:', imagePixels.toLocaleString());
        
        // 대용량 이미지 리사이징 제안 (15MB 이상 또는 8메가픽셀 이상)
        if (fileSizeMB > 15 || imagePixels > 8000000) {
          console.log('Large image detected, suggesting resize...');
          
          Alert.alert(
            '대용량 이미지',
            `이미지가 큽니다 (${fileSizeMB.toFixed(1)}MB). OCR 처리 속도 향상을 위해 크기를 줄이시겠습니까?`,
            [
              { 
                text: '크기 줄이기', 
                onPress: async () => {
                  try {
                    console.log('Resizing large image...');
                    
                    // ImagePicker의 편집 모드로 리사이징
                    const resizeResult = await ImagePicker.launchImageLibraryAsync({
                      ...pickerOptions,
                      allowsEditing: true,
                      quality: 0.7, // 품질 조금 낮춤
                    });
                    
                    if (!resizeResult.canceled && resizeResult.assets && resizeResult.assets.length > 0) {
                      console.log('Image resize successful');
                      await processImage(resizeResult.assets[0].uri);
                    } else {
                      console.log('Image resize cancelled, using original');
                      await processImage(selectedImageUri);
                    }
                  } catch (resizeError) {
                    console.error('Image resize error:', resizeError);
                    await processImage(selectedImageUri);
                  }
                }
              },
              { 
                text: '원본 사용', 
                onPress: () => processImage(selectedImageUri) 
              }
            ]
          );
          return;
        }
        
        console.log('Starting OCR processing for gallery image...');
        await processImage(selectedImageUri);
        
      } else {
        console.log('Gallery selection cancelled by user');
        setLoading(false);
        setIsProcessing(false);
      }
    } catch (error: any) {
      console.error('=== Gallery Selection Error ===');
      console.error('Error type:', error.constructor.name);
      console.error('Error message:', error.message);
      console.error('Error code:', error.code);
      console.error('Error stack:', error.stack);
      console.error('Full error object:', JSON.stringify(error, null, 2));
      
      setLoading(false);
      setIsProcessing(false);
      
      // iOS 특수 에러 처리
      if (Platform.OS === 'ios') {
        // iOS 14+ Limited Photos Library 에러
        if (error.code === 'ERR_IMAGE_PICKER_PERMISSION_DENIED' || 
            error.message?.includes('limited') || 
            error.message?.includes('Limited')) {
          Alert.alert(
            'iOS 사진 접근 제한',
            '사진 접근이 "선택한 사진"으로 제한되어 있습니다. 설정에서 "모든 사진" 또는 더 많은 사진을 선택해주세요.',
            [
              { text: '취소', style: 'cancel' },
              { 
                text: 'iOS 설정 열기', 
                onPress: () => Linking.openURL('app-settings:') 
              }
            ]
          );
          return;
        }
        
        // iOS HEIC 관련 에러
        if (error.message?.includes('HEIC') || error.message?.includes('heic')) {
          Alert.alert(
            'HEIC 형식 오류',
            'HEIC 형식 이미지 처리에 실패했습니다. iPhone 설정에서 "카메라 > 형식 > 호환성 우선"을 선택하거나 다른 이미지를 선택해주세요.',
            [
              { text: '확인' },
              { 
                text: 'iPhone 설정 가이드', 
                onPress: () => {
                  Alert.alert(
                    '설정 방법',
                    '설정 > 카메라 > 형식 > "호환성 우선" 선택\n\n이렇게 하면 앞으로 JPEG 형식으로 저장됩니다.'
                  );
                }
              }
            ]
          );
          return;
        }
      }
      
      // 권한 관련 오류인지 확인
      if (error.message?.includes('permission') || 
          error.message?.includes('Permission') ||
          error.code === 'ERR_IMAGE_PICKER_PERMISSION_DENIED') {
        Alert.alert(
          '권한 필요', 
          Platform.OS === 'ios' 
            ? '갤러리 접근 권한이 필요합니다. iOS 설정에서 "사진"을 "모든 사진" 또는 "선택한 사진"으로 설정해주세요.'
            : '갤러리 접근 권한이 필요합니다. 설정에서 권한을 허용해주세요.',
          [
            { text: '취소', style: 'cancel' },
            { 
              text: '설정 열기', 
              onPress: () => {
                if (Platform.OS === 'ios') {
                  Linking.openURL('app-settings:');
                } else {
                  Linking.openSettings();
                }
              }
            }
          ]
        );
      } else {
        // 더 구체적인 에러 메시지 제공
        let errorMessage = '갤러리에서 이미지를 선택하는데 실패했습니다.';
        
        if (error.message?.includes('cancelled') || error.message?.includes('canceled')) {
          console.log('User cancelled gallery selection');
          return; // 사용자가 취소한 경우 에러 표시 안함
        } else if (error.message?.includes('No such file')) {
          errorMessage = '선택한 파일을 찾을 수 없습니다. 클라우드 동기화 상태를 확인하거나 다른 이미지를 선택해주세요.';
        } else if (error.message?.includes('network') || error.message?.includes('Network')) {
          errorMessage = '네트워크 연결 상태를 확인하고 다시 시도해주세요.';
        } else if (error.message?.includes('timeout')) {
          errorMessage = '이미지 로딩 시간이 초과되었습니다. 더 작은 이미지를 선택하거나 네트워크 상태를 확인해주세요.';
        }
        
        Alert.alert(
          '갤러리 오류', 
          errorMessage + (Platform.OS === 'ios' ? '\n\niOS에서는 HEIC 형식 대신 JPEG 형식 사용을 권장합니다.' : ''),
          [
            { text: '확인' },
            { 
              text: '디버그 정보', 
              onPress: () => {
                Alert.alert('디버그 정보', `에러 코드: ${error.code || 'N/A'}\n에러 메시지: ${error.message || 'Unknown'}`);
              }
            }
          ]
        );
      }
    }
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
            onPress={safePickFromGallery}
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
              {/* 빈 결과 특별 처리 */}
              {(!ocrResult?.amount && !ocrResult?.description && ocrResult?.confidence === 0) ? (
                <View style={styles.emptyResultContainer}>
                  <Ionicons name="search-outline" size={60} color="#ccc" style={styles.emptyIcon} />
                  <Text style={styles.emptyResultTitle}>텍스트를 인식할 수 없습니다</Text>
                  <Text style={styles.emptyResultMessage}>
                    빈 화면이거나 텍스트가 흐릿해서 인식하지 못했습니다.
                  </Text>
                  <View style={styles.emptyResultSuggestions}>
                    <Text style={styles.suggestionTitle}>💡 개선 방법:</Text>
                    <Text style={styles.suggestionItem}>• 영수증이 프레임 안에 완전히 들어오게 촬영</Text>
                    <Text style={styles.suggestionItem}>• 충분한 조명 아래에서 촬영</Text>
                    <Text style={styles.suggestionItem}>• 영수증을 평평하게 펴서 촬영</Text>
                    <Text style={styles.suggestionItem}>• 손떨림 없이 선명하게 촬영</Text>
                  </View>
                </View>
              ) : (
                <>
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
                  
                  {ocrResult?.expenseItems && ocrResult.expenseItems.length > 0 && (
                    <View style={styles.resultSection}>
                      <Text style={styles.resultLabel}>💳 인식된 지출 항목들</Text>
                      <Text style={styles.candidatePreview}>
                        {ocrResult.expenseItems.slice(0, 2).map(item => `${item.description} ${item.amount}원`).join('\n')}
                        {ocrResult.expenseItems.length > 2 && '\n...'}
                      </Text>
                    </View>
                  )}
                </>
              )}
            </ScrollView>
            
            <View style={styles.modalActions}>
              {/* 빈 결과일 때 특별한 액션 버튼들 */}
              {(!ocrResult?.amount && !ocrResult?.description && ocrResult?.confidence === 0) ? (
                <>
                  <TouchableOpacity 
                    style={[styles.secondaryButton]}
                    onPress={() => {
                      setShowOcrResult(false);
                      setTimeout(() => {
                        handleTakePhoto();
                      }, 300);
                    }}
                  >
                    <Ionicons name="camera" size={20} color="#4A90E2" />
                    <Text style={styles.secondaryButtonText}>다시 촬영</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={[styles.primaryButton]}
                    onPress={() => {
                      setShowOcrResult(false);
                      router.replace({
                        pathname: '/expense/detail',
                        params: { 
                          tripId, 
                          tripName,
                          ocrAmount: '',
                          ocrDescription: '',
                          ocrError: 'empty_screen'
                        }
                      });
                    }}
                  >
                    <Ionicons name="create-outline" size={20} color="white" />
                    <Text style={styles.primaryButtonText}>수동 입력</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <TouchableOpacity 
                    style={[styles.primaryButton, buttonDisabled && styles.buttonDisabled]}
                    onPress={openNumberSelector}
                    disabled={buttonDisabled}
                  >
                    <Text style={[styles.primaryButtonText, buttonDisabled && styles.buttonDisabledText, {marginLeft: 0}]}>선택하기</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={[styles.primaryButton, buttonDisabled && styles.buttonDisabled]}
                    onPress={applyOcrResult}
                    disabled={buttonDisabled}
                  >
                    <Text style={[styles.primaryButtonText, buttonDisabled && styles.buttonDisabledText, {marginLeft: 0}]}>적용하기</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* 숫자/지출 항목 선택 모달 */}
      <Modal
        visible={showNumberSelector}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowNumberSelector(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {ocrResult?.expenseItems && ocrResult.expenseItems.length > 0 ? '💳 지출 항목 선택' : '🔢 금액 선택'}
              </Text>
              <TouchableOpacity 
                onPress={() => {
                  setButtonDisabled(false);
                  setSelectedExpenseItems(new Set());
                  setTotalSelectedAmount(0);
                  setShowNumberSelector(false);
                }}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.selectorDescription}>
              {ocrResult?.expenseItems && ocrResult.expenseItems.length > 0 
                ? '영수증에서 인식된 지출 항목들 중 기록하고 싶은 항목을 선택해주세요 (여러 개 선택 가능)'
                : '영수증에서 인식된 숫자들 중 총금액에 해당하는 숫자를 선택해주세요'
              }
            </Text>
            
            {/* 선택된 항목들의 총액 표시 */}
            {ocrResult?.expenseItems && ocrResult.expenseItems.length > 0 && selectedExpenseItems.size > 0 && (
              <View style={styles.selectedSummary}>
                <Text style={styles.selectedSummaryText}>
                  선택된 항목: {selectedExpenseItems.size}개
                </Text>
                <Text style={styles.selectedTotalAmount}>
                  총 금액: {totalSelectedAmount.toLocaleString()}원
                </Text>
              </View>
            )}
            
            <ScrollView style={styles.numberList}>
              {/* 지출 항목들 우선 표시 (다중 선택 지원) */}
              {ocrResult?.expenseItems && ocrResult.expenseItems.length > 0 ? (
                ocrResult.expenseItems.map((item, index) => (
                  <TouchableOpacity
                    key={`expense-${index}`}
                    style={[
                      styles.expenseItem, 
                      selectedExpenseItems.has(index) && styles.expenseItemSelected,
                      buttonDisabled && styles.buttonDisabled
                    ]}
                    onPress={() => toggleExpenseItem(index)}
                    disabled={buttonDisabled}
                  >
                    <View style={styles.expenseItemContent}>
                      <View style={styles.expenseItemHeader}>
                        <View style={[
                          styles.checkbox,
                          selectedExpenseItems.has(index) && styles.checkboxSelected
                        ]}>
                          {selectedExpenseItems.has(index) && (
                            <Ionicons name="checkmark" size={16} color="white" />
                          )}
                        </View>
                        <View style={styles.expenseItemInfo}>
                          <Text style={[styles.expenseDescription, buttonDisabled && styles.buttonDisabledText]}>
                            {item.description}
                          </Text>
                          <Text style={[styles.expenseAmount, buttonDisabled && styles.buttonDisabledText]}>
                            {item.amount}원
                          </Text>
                        </View>
                      </View>
                      <View style={styles.expenseItemMeta}>
                        <Text style={styles.confidenceText}>
                          신뢰도: {Math.round((item.confidence || 0.8) * 100)}%
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))
              ) : (
                /* 지출 항목이 없을 때 기존 숫자 선택기 */
                ocrResult?.candidateNumbers?.map((number, index) => (
                  <TouchableOpacity
                    key={`number-${index}`}
                    style={[styles.numberItem, buttonDisabled && styles.buttonDisabled]}
                    onPress={() => selectNumber(number)}
                    disabled={buttonDisabled}
                  >
                    <Text style={[styles.numberText, buttonDisabled && styles.buttonDisabledText]}>{number}</Text>
                    <Text style={[styles.numberUnit, buttonDisabled && styles.buttonDisabledText]}>
                      {parseFloat(number.replace(/,/g, '')) >= 1000 ? '원' : '$'}
                    </Text>
                  </TouchableOpacity>
                ))
              )}
              
              {(!ocrResult?.expenseItems || ocrResult.expenseItems.length === 0) && 
               (!ocrResult?.candidateNumbers || ocrResult.candidateNumbers.length === 0) && (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>인식된 항목이 없습니다</Text>
                  <Text style={styles.emptySubText}>수동으로 입력해주세요</Text>
                </View>
              )}
            </ScrollView>
            
            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={styles.secondaryButton}
                onPress={() => {
                  setButtonDisabled(false);
                  setSelectedExpenseItems(new Set());
                  setTotalSelectedAmount(0);
                  setShowNumberSelector(false);
                  setShowOcrResult(true);
                }}
              >
                <Text style={styles.secondaryButtonText}>뒤로</Text>
              </TouchableOpacity>
              
              {/* 지출 항목이 있을 때는 선택 적용 버튼 표시 */}
              {ocrResult?.expenseItems && ocrResult.expenseItems.length > 0 ? (
                <TouchableOpacity 
                  style={[
                    styles.primaryButton,
                    (buttonDisabled || selectedExpenseItems.size === 0) && styles.buttonDisabled
                  ]}
                  onPress={applySelectedExpenseItems}
                  disabled={buttonDisabled || selectedExpenseItems.size === 0}
                >
                  <Text style={[
                    styles.primaryButtonText,
                    (buttonDisabled || selectedExpenseItems.size === 0) && styles.buttonDisabledText
                  ]}>
                    선택 적용 ({selectedExpenseItems.size}개)
                  </Text>
                </TouchableOpacity>
              ) : (
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
              )}
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
  
  // 다중 선택 관련 스타일
  selectedSummary: {
    backgroundColor: '#E8F4FD',
    padding: 16,
    margin: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#4A90E2',
  },
  selectedSummaryText: {
    fontSize: 14,
    color: '#4A90E2',
    fontWeight: '500',
    marginBottom: 4,
  },
  selectedTotalAmount: {
    fontSize: 18,
    color: '#4A90E2',
    fontWeight: '700',
  },
  expenseItemSelected: {
    backgroundColor: '#E8F4FD',
    borderColor: '#4A90E2',
    borderWidth: 2,
  },
  expenseItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  checkboxSelected: {
    backgroundColor: '#4A90E2',
    borderColor: '#4A90E2',
  },
  expenseItemInfo: {
    flex: 1,
  },
  
  // 버튼 스타일
  primaryButton: {
    flex: 1,
    backgroundColor: '#4A90E2',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: 'white',
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    marginRight: 8,
  },
  secondaryButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
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
  expenseItem: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginVertical: 4,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  expenseItemContent: {
    flex: 1,
  },
  expenseDescription: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  expenseAmount: {
    fontSize: 18,
    color: '#4A90E2',
    fontWeight: 'bold',
  },
  expenseItemMeta: {
    marginTop: 8,
  },
  confidenceText: {
    fontSize: 12,
    color: '#999',
  },
  emptyResultContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyIcon: {
    marginBottom: 10,
  },
  emptyResultTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
  emptyResultMessage: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  emptyResultSuggestions: {
    alignItems: 'center',
  },
  suggestionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4A90E2',
    marginBottom: 10,
  },
  suggestionItem: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 5,
  },
}); 