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
      
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('권한 필요', '갤러리 접근 권한이 필요합니다.');
        return;
      }

      console.log('Gallery permission granted, launching image picker...');
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      console.log('Image picker result:', result);

      if (!result.canceled && result.assets[0]) {
        console.log('Selected image URI:', result.assets[0].uri);
        await processImage(result.assets[0].uri);
      } else {
        console.log('Image selection was canceled or no image selected');
      }
    } catch (error: any) {
      console.error('Gallery error:', error);
      Alert.alert('오류', '갤러리에서 이미지를 선택하는데 실패했습니다: ' + error.message);
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
      
      // 더 상세한 오류 정보 표시
      const errorMessage = `OCR 처리 실패:\n${error.message}\n\n개발자 정보:\n${error.stack?.substring(0, 200) || '스택 정보 없음'}`;
      
      Alert.alert(
        '오류', 
        errorMessage,
        [
          { text: '확인', style: 'default' },
          { text: '다시 시도', onPress: () => console.log('사용자가 다시 시도를 선택함') }
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

        {/* OCR 테스트 버튼 */}
        <TouchableOpacity 
          style={styles.testButton}
          onPress={async () => {
            try {
              // 테스트용 가짜 이미지 URI로 OCR 테스트
              Alert.alert(
                'OCR 테스트',
                'OCR 기능을 테스트하시겠습니까? (가짜 데이터로 테스트)',
                [
                  { text: '취소', style: 'cancel' },
                  { 
                    text: '테스트', 
                    onPress: async () => {
                      console.log('OCR 테스트 시작...');
                      const testResult: OCRResult = {
                        amount: '12500',
                        description: '테스트 카페',
                        rawText: '테스트 카페\n아메리카노 5000원\n라떼 7500원\n합계 12500원',
                        confidence: 0.95
                      };
                      
                      Alert.alert(
                        'OCR 테스트 결과',
                        `금액: ${testResult.amount}\n설명: ${testResult.description}`,
                        [
                          { text: '확인' },
                          {
                            text: '적용하기',
                            onPress: () => {
                              router.replace({
                                pathname: '/expense/detail',
                                params: { 
                                  tripId, 
                                  tripName,
                                  ocrAmount: testResult.amount,
                                  ocrDescription: testResult.description
                                }
                              });
                            }
                          }
                        ]
                      );
                    }
                  }
                ]
              );
            } catch (error) {
              console.error('OCR 테스트 오류:', error);
            }
          }}
        >
          <Text style={styles.testButtonText}>OCR 테스트</Text>
        </TouchableOpacity>
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
  testButton: {
    backgroundColor: '#4A90E2',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 20,
  },
  testButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
}); 