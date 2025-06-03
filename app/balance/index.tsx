import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { getCurrentUser, getTripById, getUserSettlements } from '../../services/firebaseService';
import { Settlement, Trip } from '../../types';

type GroupedSettlements = {
  [tripId: string]: {
    trip?: Trip;
    toMe: Settlement[];
    fromMe: Settlement[];
  }
};

export default function BalanceScreen() {
  const [grouped, setGrouped] = useState<GroupedSettlements>({});
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const user = getCurrentUser();
      if (!user) return;
      setUserId(user.uid);
      const settlements = await getUserSettlements(user.uid);
      // 여행별로 그룹핑
      const group: GroupedSettlements = {};
      for (const s of settlements) {
        if (!group[s.tripId]) group[s.tripId] = { toMe: [], fromMe: [] };
        if (s.to === user.uid) group[s.tripId].toMe.push(s);
        else if (s.from === user.uid) group[s.tripId].fromMe.push(s);
      }
      // 여행 정보 fetch
      await Promise.all(Object.keys(group).map(async (tripId) => {
        const trip = await getTripById(tripId);
        group[tripId].trip = trip || undefined;
      }));
      setGrouped(group);
      setLoading(false);
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>로딩 중...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
          <Ionicons name="close" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>내 정산 내역</Text>
        <View style={styles.placeholder} />
      </View>
      <ScrollView style={{ flex: 1 }}>
        {Object.keys(grouped).length === 0 && (
          <Text style={{ textAlign: 'center', marginTop: 40, color: '#888' }}>정산 내역이 없습니다.</Text>
        )}
        {Object.entries(grouped).map(([tripId, { trip, toMe, fromMe }]) => (
          <View key={tripId} style={{ marginBottom: 32 }}>
            <Text style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 8 }}>{trip?.name || '여행'}</Text>
            {/* 내가 받을 돈 */}
            {toMe.length > 0 && <Text style={{ color: '#27ae60', marginBottom: 4 }}>내가 받을 돈</Text>}
            {toMe.map(s => (
              <View key={s.id} style={styles.balanceItem}>
                <Text style={styles.itemName}>{s.from}</Text>
                <Text style={styles.amountText}>+{s.amount.toLocaleString()} {s.currency}</Text>
                <Text style={styles.settledText}>{s.settled ? '정산 완료' : '미정산'}</Text>
              </View>
            ))}
            {/* 내가 줄 돈 */}
            {fromMe.length > 0 && <Text style={{ color: '#e74c3c', marginTop: 8, marginBottom: 4 }}>내가 줄 돈</Text>}
            {fromMe.map(s => (
              <View key={s.id} style={styles.balanceItem}>
                <Text style={styles.itemName}>{s.to}</Text>
                <Text style={styles.amountText}>-{s.amount.toLocaleString()} {s.currency}</Text>
                <Text style={styles.settledText}>{s.settled ? '정산 완료' : '미정산'}</Text>
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
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
  closeButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    flex: 1,
  },
  placeholder: {
    width: 32,
  },
  list: {
    flex: 1,
    paddingHorizontal: 16,
  },
  balanceItem: {
    backgroundColor: 'white',
    marginVertical: 4,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  balanceItemSelected: {
    borderWidth: 2,
    borderColor: '#4A90E2',
  },
  itemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  bankInfo: {
    fontSize: 12,
    color: '#666',
  },
  itemRight: {
    alignItems: 'flex-end',
  },
  amountContainer: {
    alignItems: 'flex-end',
    marginBottom: 8,
  },
  owedLabel: {
    fontSize: 12,
    color: '#4A90E2',
    marginBottom: 2,
  },
  amountText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4A90E2',
  },
  payButton: {
    backgroundColor: '#4A90E2',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
  },
  payButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  footer: {
    padding: 20,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
  },
  settleButton: {
    backgroundColor: '#4A90E2',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  settleButtonDisabled: {
    backgroundColor: '#BDC3C7',
  },
  settleButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  settledText: {
    fontSize: 12,
    color: '#666',
  },
}); 