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
import {
  CameraView,
  useCameraPermissionsWrapper,
  takePicture,
  pickFromGallery,
  isWebPlatform
} from '../../services/cameraService';
import { processImageWithClovaOCR, OCRResult } from '../../services/ocrService';

export default function CameraScreen() {
  const { tripId, tripName } = useLocalSearchParams();
  const [loading, setLoading] = useState(false);
  const { permission, requestPermission } = useCameraPermissionsWrapper();
  const [facing, setFacing] = useState<string>('back');
  const cameraRef = useRef<any>(null);

  const handlePickFromGallery = async () => {
    try {
      setLoading(true);
      const imageUri = await pickFromGallery();
      await processImage(imageUri);
    } catch (error: any) {
      console.error('Gallery error:', error);
      if (error.message !== 'No image selected') {
        Alert.alert('오류', '갤러리에서 이미지를 선택하는데 실패했습니다.');
      }
    } finally {
      setLoading(false);
    }
  };

  const processImage = async (imageUri: string) => {
    try {
      setLoading(true);
      
      console.log('Processing image with Clova OCR:', imageUri);
      
      // 실제 Clova OCR 처리
      const ocrResult: OCRResult = await processImageWithClovaOCR(imageUri);
      
      console.log('OCR processing completed:', ocrResult);
      
      // OCR 결과 표시 및 확인
      const resultMessage = `인식된 내용:\n` +
        `금액: ${ocrResult.amount || '인식 실패'}\n` +
        `설명: ${ocrResult.description || '인식 실패'}\n` +
        `신뢰도: ${ocrResult.confidence ? Math.round(ocrResult.confidence * 100) + '%' : '알 수 없음'}`;
      
      Alert.alert(
        'OCR 완료',
        resultMessage,
        [
          {
            text: '다시 시도',
            style: 'cancel'
          },
          {
            text: '원본 텍스트 보기',
            onPress: () => {
              Alert.alert('인식된 전체 텍스트', ocrResult.rawText || '텍스트를 인식하지 못했습니다.');
            }
          },
          {
            text: '사용하기',
            onPress: () => {
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
    } catch (error) {
      console.error('OCR processing error:', error);
      Alert.alert('오류', '영수증 인식에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  // Web에서는 카메라 기능 비활성화
  if (isWebPlatform) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.tripInfo}>
            <View style={styles.tripIcon}>
              <Ionicons name="airplane" size={20} color="white" />
            </View>
            <Text style={styles.tripName}>{tripName || '여행'}</Text>
          </View>
          <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#333" />
          </TouchableOpacity>
        </View>

        <View style={styles.cameraContainer}>
          <Text style={styles.title}>웹에서는 카메라 기능을 지원하지 않습니다</Text>
          
          <View style={styles.webFallbackContainer}>
            <Ionicons name="camera-outline" size={80} color="#ccc" />
            <Text style={styles.webFallbackText}>
              갤러리에서 영수증 이미지를 선택해주세요
            </Text>
            
            <TouchableOpacity 
              style={styles.galleryButton} 
              onPress={handlePickFromGallery}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Ionicons name="images" size={24} color="white" />
              )}
              <Text style={styles.galleryButtonText}>
                {loading ? '처리 중...' : '갤러리에서 선택'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  const handleTakePhoto = async () => {
    try {
      setLoading(true);
      
      const photo = await takePicture(cameraRef, {
        quality: 0.8,
      });
      
      if (photo?.uri) {
        await processImage(photo.uri);
      }
    } catch (error) {
      console.error('Camera error:', error);
      Alert.alert('오류', '사진 촬영에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    router.back();
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

  const toggleCameraFacing = () => {
    setFacing(current => (current === 'back' ? 'front' : 'back'));
  };

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
  },
  permissionButton: {
    padding: 16,
    backgroundColor: '#4A90E2',
    borderRadius: 8,
  },
  permissionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  // Web fallback styles
  webFallbackContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E5E5',
    borderStyle: 'dashed',
  },
  webFallbackText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 30,
    lineHeight: 24,
  },
  galleryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4A90E2',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  galleryButtonText: {
    fontSize: 16,
    color: 'white',
    fontWeight: '600',
    marginLeft: 8,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginTop: 20,
  },
  permissionDescription: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
}); 