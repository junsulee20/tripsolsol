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

  const handlePickFromGallery = async () => {
    try {
      setLoading(true);
      console.log('Starting gallery selection...');
      
      // 먼저 미디어 라이브러리 권한 요청
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      console.log('Media library permission status:', status);
      
      if (status !== 'granted') {
        Alert.alert(
          '권한 필요', 
          '갤러리 접근 권한이 필요합니다. 설정에서 권한을 허용해주세요.',
          [
            { text: '취소', style: 'cancel' },
            { 
              text: '설정으로', 
              onPress: () => {
                // 설정 앱으로 이동하는 코드는 플랫폼별로 다름
                console.log('User needs to go to settings to enable permissions');
              }
            }
          ]
        );
        return;
      }

      console.log('Gallery permission granted, launching image picker...');
      
      // ImagePicker 옵션 개선
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        base64: false, // base64는 메모리 사용량이 크므로 false로 설정
        exif: false, // EXIF 데이터는 불필요하므로 false
      });

      console.log('Image picker result:', result);

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const selectedAsset = result.assets[0];
        console.log('Selected image URI:', selectedAsset.uri);
        console.log('Image details:', {
          width: selectedAsset.width,
          height: selectedAsset.height,
          fileSize: selectedAsset.fileSize
        });
        
        // 이미지 크기 검증 (선택사항)
        if (selectedAsset.fileSize && selectedAsset.fileSize > 10 * 1024 * 1024) { // 10MB 제한
          Alert.alert(
            '이미지 크기 초과',
            '이미지 파일이 너무 큽니다. 10MB 이하의 이미지를 선택해주세요.',
            [{ text: '확인' }]
          );
          return;
        }
        
        await processImage(selectedAsset.uri);
      } else {
        console.log('Image selection was canceled or no image selected');
      }
    } catch (error: any) {
      console.error('=== Gallery Selection Error ===');
      console.error('Error type:', typeof error);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      
      // 구체적인 오류 메시지 제공
      let userMessage = '갤러리에서 이미지를 선택하는데 실패했습니다.';
      
      if (error.message.includes('ImageLoader') || error.message.includes('not found')) {
        userMessage = '이미지 처리 모듈에 문제가 있습니다. 앱을 재시작 후 다시 시도해주세요.';
      } else if (error.message.includes('permission') || error.message.includes('Permission')) {
        userMessage = '갤러리 접근 권한이 필요합니다. 설정에서 권한을 허용해주세요.';
      } else if (error.message.includes('cancelled') || error.message.includes('canceled')) {
        console.log('User cancelled image selection');
        return; // 사용자가 취소한 경우는 오류 메시지 표시 안함
      }
      
      Alert.alert(
        '갤러리 오류', 
        userMessage,
        [
          { text: '확인', style: 'default' },
          {
            text: '카메라 사용',
            onPress: () => {
              console.log('Fallback to camera due to gallery error');
              handleTakePhoto();
            }
          }
        ]
      );
    } finally {
      setLoading(false);
    }
  };

  const processImage = async (imageUri: string) => {
    try {
      setLoading(true);
      
      console.log('=== Starting OCR Processing ===');
      console.log('Image URI:', imageUri);
      
      // 이미지 URI 유효성 검사
      if (!imageUri || typeof imageUri !== 'string') {
        throw new Error('유효하지 않은 이미지 URI입니다.');
      }
      
      // 먼저 간단한 테스트로 OCR 함수가 호출되는지 확인
      console.log('Testing OCR function availability...');
      
      // 실제 Clova OCR 처리
      console.log('Calling processImageWithClovaOCR...');
      const ocrResult: OCRResult = await processImageWithClovaOCR(imageUri);
      
      console.log('=== OCR Processing Completed ===');
      console.log('OCR Result:', JSON.stringify(ocrResult, null, 2));
      
      // OCR 결과 표시 및 확인
      const resultMessage = `인식 결과:\n` +
        `금액: ${ocrResult.amount || '인식 실패'}\n` +
        `설명: ${ocrResult.description || '인식 실패'}\n` +
        `신뢰도: ${ocrResult.confidence ? Math.round(ocrResult.confidence * 100) + '%' : '알 수 없음'}\n\n` +
        `원본 텍스트 (처음 100자):\n${(ocrResult.rawText || '없음').substring(0, 100)}...`;
      
      Alert.alert(
        'OCR 완료',
        resultMessage,
        [
          {
            text: '다시 시도',
            style: 'cancel'
          },
          {
            text: '전체 텍스트 보기',
            onPress: () => {
              Alert.alert('인식된 전체 텍스트', ocrResult.rawText || '텍스트를 인식하지 못했습니다.');
            }
          },
          {
            text: '사용하기',
            onPress: () => {
              console.log('Navigating back to detail with OCR results...');
              console.log('OCR Amount:', ocrResult.amount);
              console.log('OCR Description:', ocrResult.description);
              
              router.replace({
                pathname: '/expense/detail',
                params: { 
                  tripId, 
                  tripName,
                  ocrAmount: ocrResult.amount || '',
                  ocrDescription: ocrResult.description || ''
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
      console.error('Error stack:', error.stack);
      
      // 사용자 친화적 오류 메시지와 대안 제공
      const errorMessage = error.message || 'OCR 처리 중 알 수 없는 오류가 발생했습니다.';
      
      Alert.alert(
        'OCR 처리 실패', 
        errorMessage,
        [
          { text: '취소', style: 'cancel' },
          { 
            text: '다시 시도', 
            onPress: () => {
              console.log('User chose to retry OCR');
              // 현재 이미지로 다시 시도하지 않고 새로운 촬영/선택 유도
            }
          },
          {
            text: '수동 입력',
            onPress: () => {
              console.log('User chose manual input due to OCR failure');
              router.replace({
                pathname: '/expense/detail',
                params: { 
                  tripId, 
                  tripName,
                  ocrAmount: '',
                  ocrDescription: '',
                  ocrError: 'true' // OCR 실패 상태를 전달
                }
              });
            }
          }
        ]
      );
    } finally {
      setLoading(false);
    }
  };

  const handleTakePhoto = async () => {
    try {
      console.log('Starting photo capture...');
      
      if (!cameraRef.current) {
        Alert.alert('오류', '카메라를 준비하는 중입니다. 잠시 후 다시 시도해주세요.');
        return;
      }

      setLoading(true);
      
      console.log('Taking picture with camera...');
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: false,
      });
      
      console.log('Photo captured:', photo);
      
      if (photo?.uri) {
        console.log('Photo URI:', photo.uri);
        await processImage(photo.uri);
      } else {
        console.log('No photo URI received');
        Alert.alert('오류', '사진 촬영 결과를 받지 못했습니다.');
      }
    } catch (error: any) {
      console.error('Camera error:', error);
      Alert.alert('오류', '사진 촬영에 실패했습니다: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    router.back();
  };

  const toggleCameraFacing = () => {
    setFacing(current => (current === 'back' ? 'front' : 'back'));
  };

  if (!permission) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color="#4A90E2" />
        <Text style={styles.statusText}>카메라 권한을 확인하는 중...</Text>
      </View>
    );
  }

  if (!permission.granted) {
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
          <CameraView
            ref={cameraRef}
            style={styles.camera}
            facing={facing}
          />
          
          {loading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#4A90E2" />
              <Text style={styles.loadingText}>처리 중...</Text>
            </View>
          )}
          
          <View style={styles.cameraOverlay}>
            <View style={styles.scanFrame} />
            <Text style={styles.scanText}>영수증을 프레임 안에 맞춰주세요</Text>
          </View>
        </View>

        <View style={styles.controls}>
          <TouchableOpacity 
            style={styles.controlButton} 
            onPress={handlePickFromGallery}
            disabled={loading}
          >
            <Ionicons name="images" size={24} color="#4A90E2" />
            <Text style={styles.controlButtonText}>갤러리</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.captureButton, loading && styles.captureButtonDisabled]} 
            onPress={handleTakePhoto}
            disabled={loading}
          >
            <Ionicons name="camera" size={32} color="white" />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.controlButton} 
            onPress={toggleCameraFacing}
            disabled={loading}
          >
            <Ionicons name="camera-reverse" size={24} color="#4A90E2" />
            <Text style={styles.controlButtonText}>전환</Text>
          </TouchableOpacity>
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
    paddingTop: 12,
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
    borderWidth: 2,
    borderColor: '#E5E5E5',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
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
    width: '80%',
    height: '80%',
    borderWidth: 2,
    borderColor: '#4A90E2',
    borderStyle: 'solid',
  },
  scanText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    lineHeight: 20,
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
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  permissionButton: {
    backgroundColor: '#4A90E2',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  permissionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusText: {
    fontSize: 16,
    color: '#666',
    marginTop: 12,
  },
  permissionDescription: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
    paddingHorizontal: 20,
    lineHeight: 20,
  },
}); 