import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Linking,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";

// 웹용 QR 스캔을 위한 jsQR import
let jsQR: any = null;
if (Platform.OS === 'web') {
  try {
    jsQR = require('jsqr');
  } catch (error) {
    console.warn('jsQR library not available for web QR scanning');
  }
}

/* --------- Timestamp → Date 포맷터 --------- */
type FBTimestamp =
  | { seconds: number; nanoseconds: number } // Firestore JS SDK v9+
  | { _seconds: number; _nanoseconds: number }; // v8 (웹 compat);

const toDate = (ts: FBTimestamp): Date => {
  const s = "seconds" in ts ? ts.seconds : ts._seconds;
  return new Date(s * 1000);
};

const formatDate = (d: Date) =>
  d.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

/* ------------------------------------------ */

export default function QRScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalMessage, setModalMessage] = useState('');
  const [modalType, setModalType] = useState<'success' | 'error'>('success');
  const [isWeb, setIsWeb] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scanningRef = useRef<boolean>(false);

  useEffect(() => {
    setIsWeb(Platform.OS === 'web');
  }, []);

  /* 웹 카메라 초기화 */
  useEffect(() => {
    if (isWeb) {
      const initializeWebCamera = async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
              facingMode: 'environment',
              width: { ideal: 1280 },
              height: { ideal: 720 }
            } 
          });
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            scanningRef.current = true;
          }
        } catch (error) {
          console.error('웹 카메라 접근 실패:', error);
          Alert.alert(
            "카메라 권한 필요",
            "QR 코드를 스캔하기 위해서는 카메라 권한이 필요합니다.",
            [
              {
                text: "설정으로 이동",
                onPress: () => {
                  window.open('chrome://settings/content/camera', '_blank');
                }
              },
              {
                text: "취소",
                style: "cancel",
                onPress: () => router.back()
              }
            ]
          );
        }
      };

      initializeWebCamera();

      return () => {
        scanningRef.current = false;
        if (videoRef.current?.srcObject) {
          const stream = videoRef.current.srcObject as MediaStream;
          stream.getTracks().forEach(track => track.stop());
        }
      };
    }
  }, [isWeb]);

  /* 웹 QR 스캔 */
  useEffect(() => {
    if (!isWeb || scanned || !jsQR) return;

    const scanQR = async () => {
      if (!videoRef.current || !canvasRef.current || !scanningRef.current) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      if (!context) return;

      const scan = () => {
        if (video.readyState === video.HAVE_ENOUGH_DATA && scanningRef.current && !scanned) {
          canvas.height = video.videoHeight;
          canvas.width = video.videoWidth;
          context.drawImage(video, 0, 0, canvas.width, canvas.height);
          
          try {
            const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(imageData.data, imageData.width, imageData.height, {
              inversionAttempts: "dontInvert",
            });

            if (code) {
              console.log('웹에서 QR 코드 발견:', code.data);
              handleBarCodeScanned({ data: code.data });
              return; // 스캔 성공 시 더 이상 스캔하지 않음
            }
          } catch (error) {
            console.error('QR 스캔 실패:', error);
          }
        }
        
        if (scanningRef.current && !scanned) {
          requestAnimationFrame(scan);
        }
      };

      scan();
    };

    const startScanning = () => {
      if (videoRef.current && videoRef.current.readyState >= 3) {
        scanQR();
      } else {
        // 비디오가 로드될 때까지 대기
        videoRef.current?.addEventListener('loadeddata', scanQR, { once: true });
      }
    };

    startScanning();
  }, [isWeb, scanned]);

  /* 스캔 결과 처리 */
  const handleBarCodeScanned = ({ data }: { data: string }) => {
    if (scanned) return;
    
    console.log('QR 코드 스캔됨:', data);
    setScanned(true);
    scanningRef.current = false;

    try {
      const qrData = JSON.parse(data);
      if (qrData.type === "trip" && qrData.tripId) {
        showModal('QR 코드가 성공적으로 스캔되었습니다.', 'success');
        // 여행 페이지로 이동
        setTimeout(() => {
          router.push(`/trip/${qrData.tripId}`);
        }, 1500);
      } else {
        showModal('유효하지 않은 QR 코드입니다.', 'error');
        setTimeout(() => {
          setScanned(false);
          scanningRef.current = true;
        }, 2000);
      }
    } catch (error) {
      console.error('QR 코드 스캔 실패:', error);
      showModal('QR 코드를 인식할 수 없습니다.', 'error');
      setTimeout(() => {
        setScanned(false);
        scanningRef.current = true;
      }, 2000);
    }
  };

  const showModal = (message: string, type: 'success' | 'error') => {
    setModalMessage(message);
    setModalType(type);
    setModalVisible(true);
    setTimeout(() => {
      setModalVisible(false);
      if (type === 'error') {
        setScanned(false);
        scanningRef.current = true;
      }
    }, 2000);
  };

  /* 권한 확인 */
  if (!permission) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>카메라 권한을 요청하는 중...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>카메라 접근 권한이 필요합니다</Text>
        <TouchableOpacity 
          style={styles.button} 
          onPress={requestPermission}
        >
          <Text style={styles.buttonText}>권한 요청</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.button} 
          onPress={() => router.back()}
        >
          <Text style={styles.buttonText}>뒤로 가기</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // 웹에서 jsQR이 없는 경우 알림
  if (isWeb && !jsQR) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>QR 코드 스캔</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.centerContent}>
          <Text style={styles.text}>웹에서 QR 스캔을 사용할 수 없습니다.</Text>
          <Text style={styles.text}>모바일 앱을 사용해주세요.</Text>
          <TouchableOpacity 
            style={styles.button} 
            onPress={() => router.back()}
          >
            <Text style={styles.buttonText}>뒤로 가기</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>QR 코드 스캔</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.cameraContainer}>
        {isWeb ? (
          <>
            <video
              ref={videoRef}
              style={styles.camera}
              autoPlay
              playsInline
              muted
            />
            <canvas
              ref={canvasRef}
              style={{ display: 'none' }}
            />
          </>
        ) : (
          <CameraView
            style={styles.camera}
            facing="back"
            barcodeScannerSettings={{
              barcodeTypes: ["qr"],
            }}
            onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
          />
        )}

        <View style={styles.overlay}>
          <View style={styles.scanArea}>
            <View style={styles.scanFrame}>
              <View style={styles.cornerTL} />
              <View style={styles.cornerTR} />
              <View style={styles.cornerBL} />
              <View style={styles.cornerBR} />
            </View>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.instruction}>QR 코드를 프레임 안에 위치시켜주세요</Text>
          {scanned && (
            <TouchableOpacity 
              style={styles.button}
              onPress={() => {
                setScanned(false);
                scanningRef.current = true;
              }}
            >
              <Text style={styles.buttonText}>다시 스캔</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <Modal
        animationType="fade"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={[
            styles.modalContent,
            modalType === 'success' ? styles.successModal : styles.errorModal
          ]}>
            <Text style={styles.modalText}>{modalMessage}</Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/* ------------- Styles (동일) ------------- */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
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
  },
  backButton: {
    width: 32,
    height: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
  },
  placeholder: {
    width: 32,
  },
  cameraContainer: {
    flex: 1,
    position: 'relative',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  scanArea: {
    width: '100%',
    height: '100%',
    justifyContent: "center",
    alignItems: "center",
  },
  scanFrame: {
    width: 250,
    height: 250,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.3)",
    backgroundColor: "transparent",
    position: 'relative',
  },
  cornerTL: {
    position: 'absolute',
    top: -2,
    left: -2,
    width: 20,
    height: 20,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderColor: '#fff',
  },
  cornerTR: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 20,
    height: 20,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderColor: '#fff',
  },
  cornerBL: {
    position: 'absolute',
    bottom: -2,
    left: -2,
    width: 20,
    height: 20,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderColor: '#fff',
  },
  cornerBR: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderColor: '#fff',
  },
  footer: {
    position: "absolute",
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  instruction: {
    color: "#fff",
    fontSize: 16,
    textAlign: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
    padding: 10,
    borderRadius: 8,
  },
  text: {
    color: "#fff",
    fontSize: 16,
    textAlign: "center",
    marginTop: 20,
  },
  button: {
    backgroundColor: "#007AFF",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 20,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContent: {
    padding: 20,
    borderRadius: 12,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  successModal: {
    backgroundColor: "#4CAF50",
  },
  errorModal: {
    backgroundColor: "#F44336",
  },
  modalText: {
    fontSize: 16,
    color: "white",
    textAlign: "center",
  },
});
