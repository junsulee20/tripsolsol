import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert
} from 'react-native';
import { Camera as ExpoCamera } from 'expo-camera';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function CameraScreen() {
  const { tripId, tripName } = useLocalSearchParams();
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const cameraRef = useRef<any>(null);

  useEffect(() => {
    (async () => {
      const { status } = await ExpoCamera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
    })();
  }, []);

  const handleCapture = async () => {
    if (!cameraRef.current) return;

    setIsScanning(true);
    try {
      const photo = await cameraRef.current.takePictureAsync();
      // TODO: Implement OCR processing here
      // For now, we'll simulate OCR with a mock amount
      const mockAmount = "12345";
      
      // Navigate to detail page with the scanned amount
      router.push({
        pathname: '/expense/detail',
        params: { 
          tripId,
          tripName,
          scannedAmount: mockAmount
        }
      });
    } catch (error) {
      console.error('Error capturing photo:', error);
      Alert.alert('오류', '사진 촬영 중 오류가 발생했습니다.');
    } finally {
      setIsScanning(false);
    }
  };

  const handleClose = () => {
    router.push({
      pathname: '/expense/detail',
      params: { tripId, tripName }
    });
  };

  if (hasPermission === null) {
    return <View style={styles.container}><ActivityIndicator size="large" /></View>;
  }
  if (hasPermission === false) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>카메라 접근 권한이 필요합니다</Text>
        <TouchableOpacity 
          style={styles.button}
          onPress={() => router.back()}
        >
          <Text style={styles.buttonText}>돌아가기</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ExpoCamera
        ref={cameraRef}
        style={styles.camera}
        type="back"
      >
        <View style={styles.overlay}>
          <TouchableOpacity 
            style={styles.closeButton}
            onPress={handleClose}
          >
            <Ionicons name="close" size={30} color="white" />
          </TouchableOpacity>
          
          <View style={styles.scanArea}>
            <View style={styles.scanFrame} />
          </View>

          <View style={styles.bottomControls}>
            <TouchableOpacity
              style={[styles.captureButton, isScanning && styles.captureButtonDisabled]}
              onPress={handleCapture}
              disabled={isScanning}
            >
              {isScanning ? (
                <ActivityIndicator color="white" />
              ) : (
                <View style={styles.captureButtonInner} />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ExpoCamera>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    padding: 10,
  },
  scanArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanFrame: {
    width: '80%',
    height: '40%',
    borderWidth: 2,
    borderColor: 'white',
    borderRadius: 10,
  },
  bottomControls: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  captureButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButtonDisabled: {
    opacity: 0.5,
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'white',
  },
  errorText: {
    color: 'white',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#4A90E2',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
  },
}); 