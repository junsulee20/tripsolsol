import { BarCodeScanner, BarCodeScannerProps } from "expo-barcode-scanner";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Alert,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

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
  const [scanning, setScanning] = useState(false);

  /* 카메라 권한 */
  useEffect(() => {
    (async () => {
      const { status } = await BarCodeScanner.requestPermissionsAsync();
      setHasPermission(status === "granted");
    })();
  }, []);

  /* 스캔 결과 */
  const onScanned = ({ data }: { data: string }) => {
    if (scanning) return;
    setScanning(true);

    try {
      const qrData = JSON.parse(data);

      if (qrData.type === "group" && qrData.groupId) {
        /* (선택) Timestamp → Date 포맷 */
        let dateInfo = "";
        if (qrData.createdAt) {
          const d = formatDate(toDate(qrData.createdAt));
          dateInfo = `\n생성: ${d}`;
        }
        if (qrData.expiresAt) {
          const d = formatDate(toDate(qrData.expiresAt));
          dateInfo += `\n만료: ${d}`;
        }

        Alert.alert(
          "그룹 참여",
          `${qrData.groupName ?? "알 수 없는 그룹"}에 참여하시겠습니까?${dateInfo}`,
          [
            {
              text: "취소",
              style: "cancel",
              onPress: () => setScanning(false),
            },
            {
              text: "참여하기",
              onPress: () =>
                router.push({
                  pathname: "/groups",
                  params: { id: qrData.groupId },
                }),
            },
          ]
        );
      } else {
        throw new Error("Invalid QR code");
      }
    } catch {
      Alert.alert("오류", "유효하지 않은 QR 코드입니다.", [
        { text: "다시 스캔", onPress: () => setScanning(false) },
      ]);
    }
  };

  /* --------- UI 렌더 --------- */
  if (hasPermission === null)
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>카메라 권한 확인 중...</Text>
      </View>
    );
  if (hasPermission === false)
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>카메라 권한이 필요합니다</Text>
        <TouchableOpacity style={styles.button} onPress={() => router.back()}>
          <Text style={styles.buttonText}>뒤로 가기</Text>
        </TouchableOpacity>
      </View>
    );

  return (
    <View style={styles.container}>
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>QR 코드 스캔</Text>
        <View style={styles.placeholder} />
      </View>

      {/* 스캐너 */}
      <Scanner
        style={StyleSheet.absoluteFillObject}
        barCodeTypes={[BarCodeScanner.Constants.BarCodeType.qr]}
        onBarCodeScanned={scanning ? undefined : onScanned}
      />

      {/* 가이드 오버레이 */}
      <View style={styles.overlay}>
        <View style={styles.scanArea} />
      </View>

      <View style={styles.footer}>
        <Text style={styles.instruction}>그룹 초대 QR 코드를 스캔해주세요</Text>
      </View>
    </View>
  );
}

/* ------------- Styles (동일) ------------- */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  backButton: { width: 32, height: 32, justifyContent: "center", alignItems: "center" },
  headerTitle: { fontSize: 18, fontWeight: "600", color: "#fff" },
  placeholder: { width: 32 },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  scanArea: { width: 250, height: 250, borderWidth: 2, borderColor: "#fff" },
  footer: { position: "absolute", bottom: 40, left: 0, right: 0, alignItems: "center" },
  instruction: {
    color: "#fff",
    fontSize: 16,
    textAlign: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
    padding: 10,
    borderRadius: 8,
  },
  loadingText: { color: "#fff", fontSize: 16, textAlign: "center", marginTop: 20 },
  button: {
    backgroundColor: "#007AFF",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 20,
  },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
