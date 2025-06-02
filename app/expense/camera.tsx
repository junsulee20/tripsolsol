import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
  Image,
  ActivityIndicator,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getCurrentUser, onAuthStateChange } from '../../services/firebaseService';
import { extractAmountFromReceipt, mockOCRExtraction, getCurrencySymbol } from '../../services/ocrService';

export default function CameraScreen() {
  const { tripId, tripName } = useLocalSearchParams();
  const [permission, requestPermission] = useCameraPermissions();
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isProcessingOCR, setIsProcessingOCR] = useState(false);
  const [ocrResult, setOcrResult] = useState<any>(null);
  const cameraRef = useRef<CameraView>(null);

  useEffect(() => {
    // Auth state listener 설정
    const unsubscribe = onAuthStateChange((user) => {
      setCurrentUser(user);
      if (!user) {
        router.replace('/auth/login');
      }
    });

    return unsubscribe;
  }, []);

  const handleCameraReady = () => {
    setIsCameraReady(true);
  };

  const takePicture = async () => {
    if (!isCameraReady || !cameraRef.current) {
      Alert.alert('오류', '카메라가 준비되지 않았습니다.');
      return;
    }

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: false,
      });
      
      if (photo) {
        setCapturedImage(photo.uri);
        // 사진을 촬영하자마자 OCR 처리 시작
        processOCR(photo.uri);
      }
    } catch (error) {
      console.error('Error taking picture:', error);
      Alert.alert('오류', '사진 촬영에 실패했습니다.');
    }
  };

  const processOCR = async (imageUri: string) => {
    setIsProcessingOCR(true);
    setOcrResult(null);

    try {
      // 개발/테스트용으로 Mock OCR 사용, 실제 배포시에는 extractAmountFromReceipt 사용
      const isDevelopment = __DEV__ || process.env.NODE_ENV === 'development';
      
      const result = isDevelopment 
        ? await mockOCRExtraction(imageUri)
        : await extractAmountFromReceipt(imageUri);
      
      setOcrResult(result);
      
      if (result.amount && result.confidence && result.confidence > 0.5) {
        // OCR 성공 시 결과 표시
        console.log('OCR Result:', result);
      } else {
        // OCR 실패 또는 낮은 신뢰도
        console.log('OCR failed or low confidence:', result);
      }
    } catch (error) {
      console.error('OCR processing error:', error);
      Alert.alert('알림', 'OCR 처리 중 오류가 발생했습니다. 수동으로 금액을 입력해주세요.');
    } finally {
      setIsProcessingOCR(false);
    }
  };

  const handleUsePicture = () => {
    let extractedAmount = '0';
    let detectedCurrency = 'KRW';
    
    if (ocrResult?.amount) {
      extractedAmount = ocrResult.amount.toString();
    }
    
    if (ocrResult?.currency) {
      detectedCurrency = ocrResult.currency;
    }
    
    router.push({
      pathname: '/expense/detail',
      params: { 
        tripId, 
        tripName,
        scannedAmount: extractedAmount,
        detectedCurrency: detectedCurrency,
        ocrConfidence: ocrResult?.confidence?.toString() || '0',
        receiptImage: capturedImage 
      }
    });
  };

  const handleRetake = () => {
    setCapturedImage(null);
    setOcrResult(null);
    setIsProcessingOCR(false);
  };

  const handleSkip = () => {
    router.push({
      pathname: '/expense/detail',
      params: { tripId, tripName }
    });
  };

  if (!permission) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4A90E2" />
          <Text style={styles.loadingText}>카메라 권한을 확인하고 있습니다...</Text>
        </View>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <View style={styles.permissionContainer}>
          <Ionicons name="camera-outline" size={64} color="#ccc" />
          <Text style={styles.permissionTitle}>카메라 권한이 필요합니다</Text>
          <Text style={styles.permissionMessage}>
            영수증을 촬영하기 위해 카메라 접근 권한이 필요합니다.
          </Text>
          <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
            <Text style={styles.permissionButtonText}>권한 허용</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
            <Text style={styles.skipButtonText}>건너뛰기</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* 공통 네비게이션 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>영수증 촬영</Text>
        <TouchableOpacity onPress={handleSkip} style={styles.skipHeaderButton}>
          <Text style={styles.skipHeaderText}>건너뛰기</Text>
        </TouchableOpacity>
      </View>

      {capturedImage ? (
        <View style={styles.previewContainer}>
          <Image source={{ uri: capturedImage }} style={styles.previewImage} />
          
          {/* OCR 처리 상태 및 결과 표시 */}
          <View style={styles.ocrStatusContainer}>
            {isProcessingOCR ? (
              <View style={styles.processingContainer}>
                <ActivityIndicator size="small" color="white" />
                <Text style={styles.processingText}>영수증을 분석하고 있습니다...</Text>
              </View>
            ) : ocrResult ? (
              <View style={styles.resultContainer}>
                {ocrResult.amount ? (
                  <View style={styles.amountContainer}>
                    <Ionicons name="checkmark-circle" size={20} color="#4ECDC4" />
                    <Text style={styles.detectedAmountText}>
                      인식된 금액: {getCurrencySymbol(ocrResult.currency || 'KRW')}{ocrResult.amount.toLocaleString()}
                    </Text>
                    <Text style={styles.confidenceText}>
                      신뢰도: {Math.round((ocrResult.confidence || 0) * 100)}%
                    </Text>
                  </View>
                ) : (
                  <View style={styles.failedContainer}>
                    <Ionicons name="warning" size={20} color="#FF6B6B" />
                    <Text style={styles.failedText}>금액을 인식하지 못했습니다</Text>
                    <Text style={styles.manualText}>수동으로 입력해주세요</Text>
                  </View>
                )}
              </View>
            ) : null}
          </View>

          <View style={styles.previewActions}>
            <TouchableOpacity style={styles.retakeButton} onPress={handleRetake}>
              <Ionicons name="refresh" size={24} color="white" />
              <Text style={styles.actionButtonText}>다시 촬영</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.useButton, isProcessingOCR && styles.useButtonDisabled]} 
              onPress={handleUsePicture}
              disabled={isProcessingOCR}
            >
              <Ionicons name="checkmark" size={24} color="white" />
              <Text style={styles.actionButtonText}>
                {isProcessingOCR ? '처리 중...' : '사용하기'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.cameraContainer}>
          <CameraView
            ref={cameraRef}
            style={styles.camera}
            facing="back"
            onCameraReady={handleCameraReady}
          />
          
          <View style={styles.overlay}>
            <View style={styles.frame} />
            <Text style={styles.instructionText}>
              영수증을 프레임 안에 맞춰 촬영해주세요
            </Text>
            <Text style={styles.subInstructionText}>
              총 금액이 잘 보이도록 촬영하면 자동으로 인식됩니다
            </Text>
          </View>

          <View style={styles.cameraControls}>
            <TouchableOpacity style={styles.galleryButton}>
              <Ionicons name="images" size={28} color="white" />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[
                styles.captureButton,
                !isCameraReady && styles.captureButtonDisabled
              ]} 
              onPress={takePicture}
              disabled={!isCameraReady}
            >
              <View style={styles.captureButtonInner} />
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.flashButton}>
              <Ionicons name="flash-off" size={28} color="white" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      <View style={styles.infoContainer}>
        <Text style={styles.tripInfo}>
          {tripName} • 지출 추가
        </Text>
        <Text style={styles.infoText}>
          영수증을 촬영하면 자동으로 금액을 인식합니다
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    padding: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
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
    color: 'white',
  },
  skipHeaderButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  skipHeaderText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#F8F9FA',
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  permissionMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  permissionButton: {
    backgroundColor: '#4A90E2',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 25,
    marginBottom: 16,
  },
  permissionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
  skipButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  skipButtonText: {
    color: '#666',
    fontSize: 16,
  },
  cameraContainer: {
    flex: 1,
    position: 'relative',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  frame: {
    width: 280,
    height: 200,
    borderWidth: 2,
    borderColor: '#4A90E2',
    borderRadius: 12,
    backgroundColor: 'transparent',
    borderStyle: 'dashed',
  },
  instructionText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
    marginTop: 20,
    textAlign: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  subInstructionText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderRadius: 6,
  },
  cameraControls: {
    position: 'absolute',
    bottom: 100,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  galleryButton: {
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 25,
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  captureButtonDisabled: {
    opacity: 0.5,
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#4A90E2',
  },
  flashButton: {
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 25,
  },
  previewContainer: {
    flex: 1,
  },
  previewImage: {
    flex: 1,
    resizeMode: 'cover',
  },
  ocrStatusContainer: {
    position: 'absolute',
    top: 120,
    left: 20,
    right: 20,
  },
  processingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
  },
  processingText: {
    color: 'white',
    fontSize: 14,
    marginLeft: 8,
    fontWeight: '500',
  },
  resultContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    padding: 16,
    borderRadius: 8,
  },
  amountContainer: {
    alignItems: 'center',
  },
  detectedAmountText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'center',
  },
  confidenceText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    marginTop: 4,
  },
  failedContainer: {
    alignItems: 'center',
  },
  failedText: {
    color: '#FF6B6B',
    fontSize: 16,
    fontWeight: '500',
    marginTop: 8,
  },
  manualText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    marginTop: 4,
  },
  previewActions: {
    position: 'absolute',
    bottom: 100,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 40,
  },
  retakeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
  },
  useButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4A90E2',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
  },
  useButtonDisabled: {
    opacity: 0.6,
  },
  actionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
  },
  infoContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    padding: 20,
    paddingBottom: 40,
  },
  tripInfo: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  infoText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    lineHeight: 20,
  },
}); 