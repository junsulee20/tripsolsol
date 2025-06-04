import { FirebaseError } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile
} from 'firebase/auth';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  or,
  orderBy,
  query,
  setDoc,
  Timestamp,
  updateDoc,
  where
} from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { Balance, Expense, Settlement, Trip, User } from '../types';

// Auth Services
export const signUp = async (email: string, password: string, name: string, bankAccount?: string): Promise<User> => {
  try {
    console.log('Starting signup process...');
    
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    console.log('User created in Firebase Auth:', userCredential.user.uid);
    
    const user: User = {
      id: userCredential.user.uid,
      email,
      name,
      bankAccount,
      createdAt: new Date()
    };
    
    // Create user document in Firestore with the same ID as auth uid
    await setDoc(doc(db, 'users', userCredential.user.uid), user);
    console.log('User document created in Firestore');
    
    // Update user profile with display name
    await updateProfile(userCredential.user, {
      displayName: name
    });
    console.log('User profile updated with display name');
    
    return user;
  } catch (error: any) {
    console.error('Signup error:', error);
    if (error instanceof FirebaseError) {
      const errorMessage = (() => {
        switch (error.code) {
          case 'auth/email-already-in-use':
            return '이미 사용 중인 이메일입니다.';
          case 'auth/invalid-email':
            return '유효하지 않은 이메일 형식입니다.';
          case 'auth/operation-not-allowed':
            return '이메일/비밀번호 로그인이 비활성화되어 있습니다.';
          case 'auth/weak-password':
            return '비밀번호가 너무 약합니다.';
          default:
            return '회원가입 중 오류가 발생했습니다.';
        }
      })();
      
      throw new Error(errorMessage);
    }
    throw error;
  }
};

export const signIn = async (email: string, password: string): Promise<FirebaseUser> => {
  try {
    console.log('Starting signin process...');
    
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    console.log('User signed in to Firebase Auth:', userCredential.user.uid);
    
    // Get user data from Firestore
    const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
    console.log('Firestore user document exists:', userDoc.exists());
    
    if (!userDoc.exists()) {
      throw new Error('사용자 정보를 찾을 수 없습니다.');
    }
    
    return userCredential.user;
  } catch (error: any) {
    console.error('Signin error:', error);
    if (error instanceof FirebaseError) {
      switch (error.code) {
        case 'auth/invalid-email':
          throw new Error('유효하지 않은 이메일 형식입니다.');
        case 'auth/user-disabled':
          throw new Error('비활성화된 계정입니다.');
        case 'auth/user-not-found':
          throw new Error('존재하지 않는 계정입니다.');
        case 'auth/wrong-password':
          throw new Error('비밀번호가 일치하지 않습니다.');
        default:
          throw new Error('로그인 중 오류가 발생했습니다.');
      }
    }
    throw error;
  }
};

export const logout = async (): Promise<void> => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('Error signing out:', error);
    throw error;
  }
};

export const getCurrentUser = (): FirebaseUser | null => {
  return auth.currentUser;
};

export const onAuthStateChange = (callback: (user: FirebaseUser | null) => void) => {
  return onAuthStateChanged(auth, callback);
};

// User Services
export const getUserById = async (userId: string): Promise<User | null> => {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (userDoc.exists()) {
      return userDoc.data() as User;
    }
    return null;
  } catch (error) {
    console.error('Error getting user:', error);
    return null;
  }
};

export const getUsersByIds = async (userIds: string[]): Promise<User[]> => {
  try {
    const users: User[] = [];
    for (const userId of userIds) {
      const user = await getUserById(userId);
      if (user) {
        users.push(user);
      }
    }
    return users;
  } catch (error) {
    console.error('Error getting users:', error);
    return [];
  }
};

export const updateUserProfile = async (updates: { displayName?: string; bankAccount?: string }): Promise<void> => {
  try {
    const user = getCurrentUser();
    if (!user) {
      throw new Error('로그인된 사용자를 찾을 수 없습니다.');
    }

    // Firebase Auth 프로필 업데이트
    if (updates.displayName) {
      await updateProfile(user, { displayName: updates.displayName });
    }

    // Firestore 사용자 문서 업데이트
    const userRef = doc(db, 'users', user.uid);
    const updateData: any = {};
    
    if (updates.displayName) {
      updateData.name = updates.displayName;
    }
    if (updates.bankAccount !== undefined) {
      updateData.bankAccount = updates.bankAccount;
    }

    await updateDoc(userRef, updateData);
    console.log('User profile updated successfully');
  } catch (error) {
    console.error('Error updating user profile:', error);
    throw new Error('프로필 업데이트에 실패했습니다.');
  }
};

// 닉네임으로 사용자 검색
export const searchUserByName = async (name: string): Promise<User[]> => {
  try {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('name', '>=', name), where('name', '<=', name + '\uf8ff'));
    const querySnapshot = await getDocs(q);
    
    const users: User[] = [];
    querySnapshot.forEach((doc) => {
      users.push({ id: doc.id, ...doc.data() } as User);
    });
    
    return users;
  } catch (error) {
    console.error('Error searching users by name:', error);
    return [];
  }
};

// Firebase 연결 테스트 함수
export const testFirebaseConnection = async (): Promise<void> => {
  try {
    console.log('Testing Firebase connection...');
    const tripsRef = collection(db, 'trips');
    const snapshot = await getDocs(tripsRef);
    console.log('Firebase connection successful. Total documents:', snapshot.size);
    
    snapshot.forEach((doc) => {
      console.log('Document:', doc.id, doc.data());
    });
  } catch (error) {
    console.error('Firebase connection failed:', error);
  }
};

// Trip Services
export const createTrip = async (trip: Omit<Trip, 'id'>): Promise<string> => {
  try {
    const tripData = {
      ...trip,
      createdAt: Timestamp.fromDate(trip.createdAt),
      startDate: Timestamp.fromDate(trip.startDate),
      endDate: Timestamp.fromDate(trip.endDate)
    };
    
    console.log('Creating trip with data:', tripData);
    const docRef = await addDoc(collection(db, 'trips'), tripData);
    console.log('Trip created with ID:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('Error creating trip:', error);
    throw new Error('여행 생성에 실패했습니다.');
  }
};

export const updateTripParticipants = async (tripId: string, participants: string[]): Promise<void> => {
  try {
    const tripRef = doc(db, 'trips', tripId);
    await updateDoc(tripRef, {
      participants,
      updatedAt: new Date()
    });
  } catch (error) {
    console.error('Error updating trip participants:', error);
    throw error;
  }
};

export const updateTripData = async (tripId: string, updates: Partial<Trip>): Promise<void> => {
  try {
    const tripRef = doc(db, 'trips', tripId);
    await updateDoc(tripRef, {
      ...updates,
      updatedAt: new Date()
    });
  } catch (error) {
    console.error('Error updating trip data:', error);
    throw error;
  }
};

export const getUserTrips = async (userId: string): Promise<Trip[]> => {
  try {
    console.log('Fetching trips for user:', userId);
    
    const tripsRef = collection(db, 'trips');
    console.log('Trips collection reference created');
    
    // 복합 인덱스 문제를 피하기 위해 orderBy 없이 먼저 조회
    const userTripsQuery = query(
      tripsRef, 
      where('participants', 'array-contains', userId)
    );
    
    console.log('Executing query for user trips...');
    const querySnapshot = await getDocs(userTripsQuery);
    console.log('User trips found:', querySnapshot.size);
    
    const trips: Trip[] = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      console.log('Processing trip:', doc.id, data);
      
      trips.push({
        id: doc.id,
        ...data,
        createdAt: data.createdAt.toDate(),
        startDate: data.startDate.toDate(),
        endDate: data.endDate.toDate()
      } as Trip);
    });
    
    // 클라이언트에서 정렬 (최신순)
    trips.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    
    console.log('Processed and sorted trips:', trips);
    return trips;
  } catch (error: any) {
    console.error('Error getting user trips:', error);
    console.error('Error details:', error?.message);
    
    // 오류가 발생하면 빈 배열 대신 더 구체적인 오류 정보를 제공
    if (error?.code === 'failed-precondition') {
      console.error('This might be due to missing Firestore indexes. Check Firebase console.');
    }
    
    return [];
  }
};

export const getTripById = async (tripId: string): Promise<Trip | null> => {
  try {
    const tripDoc = await getDoc(doc(db, 'trips', tripId));
    if (tripDoc.exists()) {
      const data = tripDoc.data();
      return {
        id: tripDoc.id,
        ...data,
        createdAt: data.createdAt.toDate(),
        startDate: data.startDate.toDate(),
        endDate: data.endDate.toDate()
      } as Trip;
    }
    return null;
  } catch (error) {
    console.error('Error getting trip:', error);
    return null;
  }
};

// Expense Services
export const addExpense = async (expense: Omit<Expense, 'id'>): Promise<string> => {
  try {
    const expenseData = {
      ...expense,
      date: Timestamp.fromDate(expense.date),
      createdAt: Timestamp.now()
    };
    
    console.log('Creating expense with data:', expenseData);
    const docRef = await addDoc(collection(db, 'expenses'), expenseData);
    console.log('Expense created with ID:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('Error creating expense:', error);
    throw new Error('지출 추가에 실패했습니다.');
  }
};

export const getTripExpenses = async (tripId: string): Promise<Expense[]> => {
  try {
    console.log('Getting expenses for tripId:', tripId);
    const expensesRef = collection(db, 'expenses');
    
    // First try with orderBy
    let q = query(expensesRef, where('tripId', '==', tripId), orderBy('date', 'desc'));
    let querySnapshot;
    
    try {
      querySnapshot = await getDocs(q);
      console.log('Query with orderBy successful, snapshot size:', querySnapshot.size);
    } catch (orderByError) {
      console.log('Query with orderBy failed, trying without orderBy:', orderByError);
      // If orderBy fails (due to missing index), try without orderBy
      q = query(expensesRef, where('tripId', '==', tripId));
      querySnapshot = await getDocs(q);
      console.log('Query without orderBy, snapshot size:', querySnapshot.size);
    }
    
    const expenses: Expense[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      console.log('Found expense document:', doc.id, data);
      expenses.push({
        id: doc.id,
        ...data,
        date: data.date.toDate(),
        createdAt: data.createdAt.toDate()
      } as Expense);
    });
    
    // Sort by date if we didn't use orderBy
    expenses.sort((a, b) => b.date.getTime() - a.date.getTime());
    
    console.log('Total expenses found:', expenses.length);
    return expenses;
  } catch (error) {
    console.error('Error getting trip expenses:', error);
    return [];
  }
};

export const updateExpense = async (expenseId: string, updates: Partial<Expense>): Promise<void> => {
  try {
    const expenseRef = doc(db, 'expenses', expenseId);
    const updatedData: any = { ...updates };
    
    if (updates.date) {
      updatedData.date = Timestamp.fromDate(updates.date);
    }
    
    await updateDoc(expenseRef, updatedData);
    console.log('Expense updated successfully');
  } catch (error) {
    console.error('Error updating expense:', error);
    throw new Error('지출 수정에 실패했습니다.');
  }
};

export const deleteExpense = async (expenseId: string): Promise<void> => {
  try {
    const expenseRef = doc(db, 'expenses', expenseId);
    await deleteDoc(expenseRef);
    console.log('Expense deleted successfully');
  } catch (error) {
    console.error('Error deleting expense:', error);
    throw new Error('지출 삭제에 실패했습니다.');
  }
};

// Settlement Services
export const addSettlement = async (settlement: Omit<Settlement, 'id'>): Promise<string> => {
  try {
    const settlementData = {
      ...settlement,
      createdAt: Timestamp.now(),
      settledAt: settlement.settledAt ? Timestamp.fromDate(settlement.settledAt) : null
    };
    
    console.log('Creating settlement with data:', settlementData);
    const docRef = await addDoc(collection(db, 'settlements'), settlementData);
    console.log('Settlement created with ID:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('Error creating settlement:', error);
    throw new Error('정산 추가에 실패했습니다.');
  }
};

export const getTripSettlements = async (tripId: string): Promise<Settlement[]> => {
  try {
    const settlementsRef = collection(db, 'settlements');
    const q = query(settlementsRef, where('tripId', '==', tripId), orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);
    
    const settlements: Settlement[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      settlements.push({
        id: doc.id,
        ...data,
        createdAt: data.createdAt.toDate(),
        settledAt: data.settledAt ? data.settledAt.toDate() : undefined
      } as Settlement);
    });
    
    return settlements;
  } catch (error) {
    console.error('Error getting trip settlements:', error);
    return [];
  }
};

export const markSettlementAsSettled = async (settlementId: string): Promise<void> => {
  try {
    const settlementRef = doc(db, 'settlements', settlementId);
    await updateDoc(settlementRef, {
      settled: true,
      settledAt: Timestamp.now()
    });
    console.log('Settlement marked as settled');
  } catch (error) {
    console.error('Error marking settlement as settled:', error);
    throw new Error('정산 완료 처리에 실패했습니다.');
  }
};

// Calculate real balances for a trip based on actual expenses
export const calculateRealTripBalances = async (tripId: string): Promise<Balance[]> => {
  try {
    const trip = await getTripById(tripId);
    if (!trip) {
      throw new Error('여행을 찾을 수 없습니다.');
    }
    
    const expenses = await getTripExpenses(tripId);
    return calculateTripBalances(expenses, trip.participants);
  } catch (error) {
    console.error('Error calculating real trip balances:', error);
    return [];
  }
};

// Calculate balances for a trip
export const calculateTripBalances = (expenses: Expense[], participants: string[]): Balance[] => {
  const balances: { [userId: string]: number } = {};
  
  // Initialize balances
  participants.forEach(userId => {
    balances[userId] = 0;
  });
  
  expenses.forEach(expense => {
    // splitDetails가 있는 경우 더 정확한 계산 사용
    if (expense.splitDetails && expense.splitDetails.length > 0) {
      // 결제자는 전체 금액을 지불했으므로 음수 (받아야 할 돈)
      balances[expense.paidBy] -= expense.amount;
      
      // 각 사용자는 자신의 몫만큼 양수 (줘야 할 돈)
      expense.splitDetails.forEach(split => {
        balances[split.userId] += split.amount;
      });
    } else {
      // 기존 방식 (균등 분할)
      const splitAmount = expense.amount / expense.splitBetween.length;
      
      // Add to payer's balance (they paid for others)
      balances[expense.paidBy] -= expense.amount;
      
      // Subtract from each person's balance (they owe money)
      expense.splitBetween.forEach(userId => {
        balances[userId] += splitAmount;
      });
    }
  });
  
  return Object.entries(balances).map(([userId, amount]) => ({
    userId,
    amount: Math.round(amount * 100) / 100 // Round to 2 decimal places
  }));
};

// 특정 사용자가 관련된 모든 Settlement(정산 내역) 반환
export const getUserSettlements = async (userId: string): Promise<Settlement[]> => {
  try {
    const settlementsRef = collection(db, 'settlements');
    // from 또는 to가 userId인 Settlement 모두 조회
    const q = query(
      settlementsRef,
      or(where('from', '==', userId), where('to', '==', userId)),
      orderBy('createdAt', 'desc')
    );
    const querySnapshot = await getDocs(q);
    const settlements: Settlement[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      settlements.push({
        id: doc.id,
        ...data,
        createdAt: data.createdAt.toDate(),
        settledAt: data.settledAt ? data.settledAt.toDate() : undefined
      } as Settlement);
    });
    return settlements;
  } catch (error) {
    console.error('Error getting user settlements:', error);
    return [];
  }
};

// 현재 로그인한 사용자의 Firestore 정보 가져오기 (캐릭터 정보 포함)
export const getCurrentUserFromFirestore = async (): Promise<(User & { photoURL?: string }) | null> => {
  try {
    const authUser = getCurrentUser();
    if (!authUser) return null;

    const userDoc = await getDoc(doc(db, 'users', authUser.uid));
    if (userDoc.exists()) {
      const userData = userDoc.data() as User;
      return {
        ...userData,
        photoURL: authUser.photoURL || userData.photoURL || undefined
      };
    }
    return null;
  } catch (error) {
    console.error('Error getting current user from Firestore:', error);
    return null;
  }
}; 