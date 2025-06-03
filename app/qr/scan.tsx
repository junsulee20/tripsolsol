import { Ionicons } from "@expo/vector-icons";
import { BarCodeScanner, BarCodeScannerProps } from "expo-barcode-scanner";
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

const Scanner = BarCodeScanner as unknown as
  React.ComponentType<BarCodeScannerProps>;

/* --------- Timestamp → Date 포맷터 --------- */
type FBTimestamp =
  | { seconds: number; nanoseconds: number } // Firestore JS SDK v9+
  | { _seconds: number; _nanoseconds: number }; // v8 (웹 compat)

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
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalMessage, setModalMessage] = useState('');
  const [modalType, setModalType] = useState<'success' | 'error'>('success');
  const [isWeb, setIsWeb] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    setIsWeb(Platform.OS === 'web');
  }, []);

  /* 카메라 권한 및 초기화 */
  useEffect(() => {
    const initializeCamera = async () => {
      if (isWeb) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            setHasPermission(true);
          }
        } catch (error) {
          console.error('웹 카메라 접근 실패:', error);
          setHasPermission(false);
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
      } else {
        try {
          const { status } = await BarCodeScanner.requestPermissionsAsync();
          setHasPermission(status === "granted");
          
          if (status !== "granted") {
            Alert.alert(
              "카메라 권한 필요",
              "QR 코드를 스캔하기 위해서는 카메라 권한이 필요합니다.",
              [
                {
                  text: "설정으로 이동",
                  onPress: () => Linking.openSettings()
                },
                {
                  text: "취소",
                  style: "cancel",
                  onPress: () => router.back()
                }
              ]
            );
          }
        } catch (error) {
          console.error('카메라 권한 요청 실패:', error);
          showModal('카메라 권한을 확인하는데 실패했습니다.', 'error');
        }
      }
    };

    initializeCamera();

    return () => {
      if (isWeb && videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [isWeb]);

  /* 웹 QR 스캔 */
  useEffect(() => {
    if (!isWeb || !hasPermission || scanned) return;

    const scanQR = async () => {
      if (!videoRef.current || !canvasRef.current) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      if (!context) return;

      const scan = () => {
        if (video.readyState === video.HAVE_ENOUGH_DATA) {
          canvas.height = video.videoHeight;
          canvas.width = video.videoWidth;
          context.drawImage(video, 0, 0, canvas.width, canvas.height);
          
          try {
            const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
            // 여기에 QR 코드 디코딩 로직 추가
            // 예: jsQR 라이브러리 사용
          } catch (error) {
            console.error('QR 스캔 실패:', error);
          }
        }
        if (!scanned) {
          requestAnimationFrame(scan);
        }
      };

      scan();
    };

    scanQR();
  }, [isWeb, hasPermission, scanned]);

  /* 스캔 결과 */
  const handleBarCodeScanned = ({ data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);

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
        }, 2000);
      }
    } catch (error) {
      console.error('QR 코드 스캔 실패:', error);
      showModal('QR 코드를 인식할 수 없습니다.', 'error');
      setTimeout(() => {
        setScanned(false);
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
      }
    }, 2000);
  };

  /* --------- UI 렌더 --------- */
  if (hasPermission === null) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>카메라 권한을 요청하는 중...</Text>
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>카메라 접근 권한이 필요합니다</Text>
        <TouchableOpacity 
          style={styles.button} 
          onPress={() => router.back()}
        >
          <Text style={styles.buttonText}>뒤로 가기</Text>
        </TouchableOpacity>
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
            />
            <canvas
              ref={canvasRef}
              style={{ display: 'none' }}
            />
          </>
        ) : (
          <Scanner
            style={styles.camera}
            barCodeTypes={[BarCodeScanner.Constants.BarCodeType.qr]}
            onBarCodeScanned={scanned ? undefined : handleBarCodeScanned}
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
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: "rgba(0,0,0,0.5)",
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
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
