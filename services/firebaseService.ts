import {
  createUserWithEmailAndPassword,
  User as FirebaseUser,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence
} from 'firebase/auth';
import { FirebaseError } from 'firebase/app';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  Timestamp,
  updateDoc,
  where,
  setDoc
} from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { Balance, Expense, Settlement, Trip, User } from '../types';

// Mock data
const mockTrips: Trip[] = [
  {
    id: 'trip-1',
    name: '미국여행',
    emoji: '🇺🇸',
    description: '라스베이거스 여행',
    startDate: new Date('2025-06-18'),
    endDate: new Date('2025-06-20'),
    participants: ['user1', 'user2', 'user3', 'user4'],
    createdBy: 'user1',
    createdAt: new Date('2025-01-15'),
    currency: 'USD',
    totalAmount: 500
  }
];

// Auth Services
export const signUp = async (email: string, password: string, name: string): Promise<User> => {
  try {
    console.log('Starting signup process...');
    // Set persistence to LOCAL to keep user logged in
    await setPersistence(auth, browserLocalPersistence);
    console.log('Persistence set to LOCAL');
    
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    console.log('User created in Firebase Auth:', userCredential.user.uid);
    
    const user: User = {
      id: userCredential.user.uid,
      email,
      name,
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
      
      const customError = new FirebaseError(error.code, errorMessage);
      customError.stack = error.stack;
      throw customError;
    }
    throw error;
  }
};

export const signIn = async (email: string, password: string): Promise<FirebaseUser> => {
  try {
    console.log('Starting signin process...');
    // Set persistence to LOCAL to keep user logged in
    await setPersistence(auth, browserLocalPersistence);
    console.log('Persistence set to LOCAL');
    
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
    console.log('Adding expense:', expense);
    
    // Convert Date objects to Timestamps and include splits in the main document
    const firestoreExpenseData = {
      ...expense,
      date: Timestamp.fromDate(expense.date),
      createdAt: Timestamp.fromDate(expense.createdAt)
    };
    
    // Add the expense document
    const expenseRef = await addDoc(collection(db, 'expenses'), firestoreExpenseData);
    console.log('Expense added with ID:', expenseRef.id);

    return expenseRef.id;
  } catch (error) {
    console.error('Error adding expense:', error);
    throw new Error('지출 추가에 실패했습니다.');
  }
};

export const getTripExpenses = async (tripId: string): Promise<Expense[]> => {
  try {
    console.log('Fetching expenses for trip:', tripId);
    
    const expensesRef = collection(db, 'expenses');
    const q = query(
      expensesRef,
      where('tripId', '==', tripId)
    );
    
    const querySnapshot = await getDocs(q);
    const expenses: Expense[] = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      try {
        // Safely convert Timestamps to Dates with error handling
        const expense: Expense = {
          id: doc.id,
          tripId: data.tripId,
          title: data.title,
          description: data.description,
          amount: data.amount,
          currency: data.currency,
          paidBy: data.paidBy,
          splitBetween: data.splitBetween,
          category: data.category,
          date: data.date?.toDate() || new Date(),
          createdAt: data.createdAt?.toDate() || new Date(),
          receipt: data.receipt
        };
        expenses.push(expense);
      } catch (conversionError) {
        console.error('Error converting expense data:', conversionError, data);
        // Skip this expense if conversion fails
      }
    });
    
    // Sort expenses by date on the client side
    expenses.sort((a, b) => b.date.getTime() - a.date.getTime());
    
    console.log(`Found ${expenses.length} expenses for trip:`, tripId);
    return expenses;
  } catch (error) {
    console.error('Error getting trip expenses:', error);
    return [];
  }
};

export const updateExpense = async (expenseId: string, updates: Partial<Expense>): Promise<void> => {
  try {
    const expenseRef = doc(db, 'expenses', expenseId);
    
    // Convert Date objects to Timestamps if they exist in updates
    const updateData = { ...updates };
    if (updates.date) {
      updateData.date = Timestamp.fromDate(updates.date);
    }
    if (updates.createdAt) {
      updateData.createdAt = Timestamp.fromDate(updates.createdAt);
    }
    
    await updateDoc(expenseRef, updateData);
    console.log('Expense updated:', expenseId);
  } catch (error) {
    console.error('Error updating expense:', error);
    throw new Error('지출 수정에 실패했습니다.');
  }
};

export const deleteExpense = async (expenseId: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, 'expenses', expenseId));
    console.log('Expense deleted:', expenseId);
  } catch (error) {
    console.error('Error deleting expense:', error);
    throw new Error('지출 삭제에 실패했습니다.');
  }
};

// Settlement Services
export const addSettlement = async (settlement: Omit<Settlement, 'id'>): Promise<string> => {
  return `settlement-${Date.now()}`;
};

export const getTripSettlements = async (tripId: string): Promise<Settlement[]> => {
  return [];
};

export const markSettlementAsSettled = async (settlementId: string): Promise<void> => {
  // Mock settle
};

// Calculate balances for a trip
export const calculateTripBalances = (expenses: Expense[], participants: string[]): Balance[] => {
  const balances: { [userId: string]: number } = {};
  
  // Initialize balances
  participants.forEach(userId => {
    balances[userId] = 0;
  });
  
  expenses.forEach(expense => {
    const splitAmount = expense.amount / expense.splitBetween.length;
    
    // Add to payer's balance (they paid for others)
    balances[expense.paidBy] -= expense.amount;
    
    // Subtract from each person's balance (they owe money)
    expense.splitBetween.forEach(userId => {
      balances[userId] += splitAmount;
    });
  });
  
  return Object.entries(balances).map(([userId, amount]) => ({
    userId,
    amount: Math.round(amount * 100) / 100 // Round to 2 decimal places
  }));
};

// Trip Member Services
export const getTripMembers = async (tripId: string): Promise<any[]> => {
  const tripRef = doc(db, 'trips', tripId);
  const tripDoc = await getDoc(tripRef);
  
  if (!tripDoc.exists()) {
    throw new Error('Trip not found');
  }

  const tripData = tripDoc.data();
  const memberIds = tripData.participants || [];
  
  const members = await Promise.all(
    memberIds.map(async (memberId: string) => {
      const userDoc = await getDoc(doc(db, 'users', memberId));
      if (userDoc.exists()) {
        return {
          id: memberId,
          name: userDoc.data().name,
          email: userDoc.data().email,
        };
      }
      return null;
    })
  );

  return members.filter(member => member !== null);
}; 