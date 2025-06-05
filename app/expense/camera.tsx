import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Platform
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { processImageWithClovaOCR, OCRResult } from '../../services/ocrService';

export default function CameraScreen() {
  const { tripId, tripName } = useLocalSearchParams();
  const [loading, setLoading] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<'front' | 'back'>('back');
  const cameraRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      setLoading(false);
      
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
      setLoading(false);
      
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
    router.back();
  };

  const toggleCameraFacing = () => {
    setFacing(current => (current === 'back' ? 'front' : 'back'));
  };

  const processImage = async (imageUri: string) => {
    if (!loading) setLoading(true); 

    try {
      console.log('=== Starting OCR Processing ===');
      console.log('Image URI:', imageUri);
      
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
      const ocrResult: OCRResult = await processImageWithClovaOCR(imageUri);
      
      console.log('=== OCR Processing Completed ===');
      console.log('OCR Result:', JSON.stringify(ocrResult, null, 2));
      
      // OCR 결과 검증 및 포맷팅
      const amount = ocrResult.amount ? String(ocrResult.amount).trim() : '';
      const description = ocrResult.description ? String(ocrResult.description).trim() : '';
      const confidence = ocrResult.confidence || 0;
      
      // 결과 표시 메시지 개선
      const resultMessage = `인식 결과:\n\n` +
        `💰 금액: ${amount || '인식 실패'}\n` +
        `🏪 설명: ${description || '인식 실패'}\n` +
        `📊 신뢰도: ${confidence > 0 ? Math.round(confidence * 100) + '%' : '알 수 없음'}\n\n` +
        `${ocrResult.rawText ? '✅ 텍스트 인식 성공' : '❌ 텍스트 인식 실패'}`;
      
      Alert.alert(
        '📋 OCR 처리 완료',
        resultMessage,
        [
          {
            text: '🔄 다시 시도',
            style: 'cancel',
            onPress: () => {
              console.log('User chose to retry OCR');
              setLoading(false);
            }
          },
          {
            text: '📝 전체 텍스트',
            onPress: () => {
              const fullText = ocrResult.rawText || '텍스트를 인식하지 못했습니다.';
              Alert.alert('인식된 전체 텍스트', fullText.length > 500 ? fullText.substring(0, 500) + '...' : fullText);
            }
          },
          {
            text: '✅ 사용하기',
            style: 'default',
            onPress: () => {
              console.log('Navigating to detail with OCR results...');
              console.log('Final OCR Amount:', amount);
              console.log('Final OCR Description:', description);
              
              setLoading(false);
              
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
          }
        ]
      );
    } catch (error: any) {
      console.error('=== OCR Processing Error ===');
      console.error('Error details:', error);
      console.error('Error message:', error.message);
      
      setLoading(false);
      
      // 오류 종류에 따른 구체적인 메시지 제공
      let errorTitle = 'OCR 처리 실패';
      let errorMessage = 'OCR 처리 중 오류가 발생했습니다.';
      
      if (error.message?.includes('CORS')) {
        errorTitle = '네트워크 오류';
        errorMessage = '웹에서는 OCR 기능이 제한됩니다. 모바일 앱에서 사용해주세요.';
      } else if (error.message?.includes('네트워크')) {
        errorTitle = '네트워크 연결 오류';
        errorMessage = '인터넷 연결을 확인하고 다시 시도해주세요.';
      } else if (error.message?.includes('API')) {
        errorTitle = 'API 오류';
        errorMessage = 'OCR 서비스에 일시적인 문제가 있습니다. 잠시 후 다시 시도해주세요.';
      } else if (error.message?.includes('권한')) {
        errorTitle = '권한 오류';
        errorMessage = 'OCR 서비스 접근 권한이 없습니다. 설정을 확인해주세요.';
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
              // 다시 시도는 새로운 이미지 선택 유도
            }
          },
          {
            text: '수동 입력',
            style: 'default',
            onPress: () => {
              console.log('User chose manual input due to OCR failure');
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
        ]
      );
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
        <Text style={styles.title}>영수증을 스캔해주세요</Text>
        
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
            style={styles.controlButton} 
            onPress={handlePickFromGallery}
            disabled={loading}
          >
            <Ionicons name="images" size={24} color="#4A90E2" />
            <Text style={styles.controlButtonText}>
              {Platform.OS === 'web' ? '갤러리' : '갤러리'}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.captureButton, loading && styles.captureButtonDisabled]} 
            onPress={handleTakePhoto}
            disabled={loading}
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
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
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
}); 