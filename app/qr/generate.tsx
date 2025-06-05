import { Ionicons } from '@expo/vector-icons';
import * as BarcodeGenerator from 'expo-barcode-generator';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { collection, getDocs, query, Timestamp, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
  Image,
  Modal,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { auth, db } from '../../config/firebase';
import { Trip } from '../../types';

type FBTimestamp = Timestamp | { toDate(): Date } | Date;

const toDate = (value: FBTimestamp): Date => {
  if (value instanceof Date) return value;
  if (value instanceof Timestamp) return value.toDate();
  if (value?.toDate) return value.toDate();
  if (typeof value === "number" || typeof value === "string")
    return new Date(value);
  throw new Error("지원하지 않는 날짜 형식");
};

export default function QRGenerateScreen() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalMessage, setModalMessage] = useState('');
  const [qrCodeImage, setQrCodeImage] = useState<string | null>(null);

  useEffect(() => {
    fetchTrips();
  }, []);

  const fetchTrips = async () => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) return;

      const tripsRef = collection(db, 'trips');
      const q = query(tripsRef, where('participants', 'array-contains', userId));
      const querySnapshot = await getDocs(q);
      
      const tripsList = querySnapshot.docs.map(doc => {
        const data = doc.data() as Trip;
        return {
          ...data,
          id: doc.id,
          startDate: toDate(data.startDate),
          endDate: toDate(data.endDate),
          createdAt: toDate(data.createdAt),
        };
      });
      setTrips(tripsList);
    } catch (error) {
      showModal('여행 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleTripSelect = (trip: Trip) => {
    setSelectedTrip(trip);
  };

  const handleShare = async () => {
    if (!selectedTrip) return;

    const inviteLink = `tripsolsol://trip/${selectedTrip.id}`;
    try {
      await Share.share({
        message: `${selectedTrip.name} 여행에 초대합니다.\n${inviteLink}`,
      });
    } catch (error) {
      showModal('공유하기에 실패했습니다.');
    }
  };

  const handleCopyLink = async () => {
    if (!selectedTrip) return;

    const inviteLink = `tripsolsol://trip/${selectedTrip.id}`;
    await Clipboard.setStringAsync(inviteLink);
    showModal('초대 링크가 복사되었습니다.');
  };

  const showModal = (message: string) => {
    setModalMessage(message);
    setModalVisible(true);
    setTimeout(() => setModalVisible(false), 2000);
  };

  const getQRData = () => {
    if (!selectedTrip) return '';
    return JSON.stringify({
      type: 'trip',
      tripId: selectedTrip.id,
      tripName: selectedTrip.name
    });
  };

  const generateQRCode = async () => {
    if (!selectedTrip) return;
    
    try {
      const qrData = getQRData();
      const qrCode = await BarcodeGenerator.generateAsync(qrData, {
        type: 'qr',
        width: 200,
        height: 200,
        backgroundColor: 'white',
        color: 'black',
        margin: 10,
      });
      setQrCodeImage(qrCode.uri);
    } catch (error) {
      console.error('QR 코드 생성 실패:', error);
      showModal('QR 코드 생성에 실패했습니다.');
    }
  };

  useEffect(() => {
    if (selectedTrip) {
      generateQRCode();
    }
  }, [selectedTrip]);

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>여행 목록을 불러오는 중...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>여행 초대 QR 코드</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content}>
        {!selectedTrip ? (
          <View style={styles.tripList}>
            <Text style={styles.sectionTitle}>여행 선택</Text>
            {trips.length === 0 ? (
              <Text style={styles.emptyText}>참여 중인 여행이 없습니다.</Text>
            ) : (
              trips.map(trip => (
                <TouchableOpacity
                  key={trip.id}
                  style={styles.tripItem}
                  onPress={() => handleTripSelect(trip)}
                >
                  <View style={styles.tripHeader}>
                    {trip.emoji && (
                      <Text style={styles.tripEmoji}>{trip.emoji}</Text>
                    )}
                    <Text style={styles.tripName}>{trip.name}</Text>
                  </View>
                  {trip.description && (
                    <Text style={styles.tripDescription}>{trip.description}</Text>
                  )}
                  <View style={styles.tripDetails}>
                    <Text style={styles.tripDate}>
                      {trip.startDate.toLocaleDateString()} ~ {trip.endDate.toLocaleDateString()}
                    </Text>
                    <Text style={styles.tripCurrency}>
                      {trip.currency} {trip.totalAmount.toLocaleString()}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>
        ) : (
          <View style={styles.qrContainer}>
            <View style={styles.tripHeader}>
              {selectedTrip.emoji && (
                <Text style={styles.tripEmoji}>{selectedTrip.emoji}</Text>
              )}
              <Text style={styles.tripName}>{selectedTrip.name}</Text>
            </View>
            
            <View style={styles.qrCode}>
              {qrCodeImage ? (
                <Image
                  source={{ uri: qrCodeImage }}
                  style={styles.qrCodeImage}
                />
              ) : (
                <View style={styles.qrCodePlaceholder}>
                  <Text>QR 코드 생성 중...</Text>
                </View>
              )}
            </View>

            <View style={styles.linkContainer}>
              <Text style={styles.linkText}>
                {`tripsolsol://trip/${selectedTrip.id}`}
              </Text>
              <TouchableOpacity 
                style={styles.copyButton}
                onPress={handleCopyLink}
              >
                <Ionicons name="copy-outline" size={20} color="#4A90E2" />
              </TouchableOpacity>
            </View>

            <View style={styles.actions}>
              <TouchableOpacity 
                style={styles.actionButton} 
                onPress={handleShare}
              >
                <Ionicons name="share-outline" size={20} color="#4A90E2" />
                <Text style={styles.actionButtonText}>공유하기</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.actionButton}
                onPress={() => setSelectedTrip(null)}
              >
                <Ionicons name="arrow-back" size={20} color="#4A90E2" />
                <Text style={styles.actionButtonText}>다른 여행 선택</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>

      <Modal
        animationType="fade"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalText}>{modalMessage}</Text>
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
    color: '#333',
  },
  placeholder: {
    width: 32,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 20,
  },
  tripList: {
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 20,
  },
  tripItem: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  tripHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  tripEmoji: {
    fontSize: 24,
    marginRight: 8,
  },
  tripName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  tripDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  tripDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tripDate: {
    fontSize: 12,
    color: '#999',
  },
  tripCurrency: {
    fontSize: 12,
    color: '#4A90E2',
    fontWeight: '500',
  },
  qrContainer: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  qrCode: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  linkContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    padding: 12,
    borderRadius: 8,
    marginBottom: 24,
    width: '100%',
  },
  linkText: {
    flex: 1,
    fontSize: 14,
    color: '#666',
  },
  copyButton: {
    padding: 8,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#4A90E2',
  },
  actionButtonText: {
    fontSize: 14,
    color: '#4A90E2',
    fontWeight: '500',
    marginLeft: 8,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalText: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
  },
  qrCodeImage: {
    width: 200,
    height: 200,
    backgroundColor: 'white',
  },
  qrCodePlaceholder: {
    width: 200,
    height: 200,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
