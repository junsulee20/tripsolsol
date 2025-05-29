import {
  createUserWithEmailAndPassword,
  User as FirebaseUser,
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
  orderBy,
  query,
  Timestamp,
  updateDoc,
  where
} from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { Balance, Expense, Settlement, Trip, User } from '../types';

// Auth Services
export const signUp = async (email: string, password: string, name: string): Promise<User> => {
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  const user: User = {
    id: userCredential.user.uid,
    email,
    name,
    createdAt: new Date()
  };
  
  await addDoc(collection(db, 'users'), user);
  return user;
};

export const signIn = async (email: string, password: string): Promise<FirebaseUser> => {
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  return userCredential.user;
};

export const logout = async (): Promise<void> => {
  await signOut(auth);
};

export const updateUserProfile = async (updates: { displayName?: string; photoURL?: string }): Promise<void> => {
  if (auth.currentUser) {
    await updateProfile(auth.currentUser, updates);
  }
};

// User Services
export const getUserById = async (userId: string): Promise<User | null> => {
  const userDoc = await getDoc(doc(db, 'users', userId));
  if (userDoc.exists()) {
    return { id: userDoc.id, ...userDoc.data() } as User;
  }
  return null;
};

export const getUsersByIds = async (userIds: string[]): Promise<User[]> => {
  const users: User[] = [];
  for (const userId of userIds) {
    const user = await getUserById(userId);
    if (user) users.push(user);
  }
  return users;
};

// Trip Services
export const createTrip = async (trip: Omit<Trip, 'id'>): Promise<string> => {
  const docRef = await addDoc(collection(db, 'trips'), {
    ...trip,
    startDate: Timestamp.fromDate(trip.startDate),
    endDate: Timestamp.fromDate(trip.endDate),
    createdAt: Timestamp.fromDate(trip.createdAt)
  });
  return docRef.id;
};

export const getUserTrips = async (userId: string): Promise<Trip[]> => {
  const q = query(
    collection(db, 'trips'),
    where('participants', 'array-contains', userId)
    // orderBy('createdAt', 'desc') // Temporarily removed until index is created
  );
  
  const querySnapshot = await getDocs(q);
  const trips = querySnapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      startDate: data.startDate?.toDate() || new Date(),
      endDate: data.endDate?.toDate() || new Date(),
      createdAt: data.createdAt?.toDate() || new Date()
    } as Trip;
  });

  // Client-side sorting as a temporary solution
  return trips.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
};

export const getTripById = async (tripId: string): Promise<Trip | null> => {
  const tripDoc = await getDoc(doc(db, 'trips', tripId));
  if (tripDoc.exists()) {
    const data = tripDoc.data();
    return {
      id: tripDoc.id,
      ...data,
      startDate: data.startDate.toDate(),
      endDate: data.endDate.toDate(),
      createdAt: data.createdAt.toDate()
    } as Trip;
  }
  return null;
};

// Expense Services
export const addExpense = async (expense: Omit<Expense, 'id'>): Promise<string> => {
  const docRef = await addDoc(collection(db, 'expenses'), {
    ...expense,
    date: Timestamp.fromDate(expense.date),
    createdAt: Timestamp.fromDate(expense.createdAt)
  });
  return docRef.id;
};

export const getTripExpenses = async (tripId: string): Promise<Expense[]> => {
  const q = query(
    collection(db, 'expenses'),
    where('tripId', '==', tripId),
    orderBy('date', 'desc')
  );
  
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    date: doc.data().date.toDate(),
    createdAt: doc.data().createdAt.toDate()
  })) as Expense[];
};

export const updateExpense = async (expenseId: string, updates: Partial<Expense>): Promise<void> => {
  const expenseRef = doc(db, 'expenses', expenseId);
  await updateDoc(expenseRef, updates);
};

export const deleteExpense = async (expenseId: string): Promise<void> => {
  await deleteDoc(doc(db, 'expenses', expenseId));
};

// Settlement Services
export const addSettlement = async (settlement: Omit<Settlement, 'id'>): Promise<string> => {
  const docRef = await addDoc(collection(db, 'settlements'), {
    ...settlement,
    createdAt: Timestamp.fromDate(settlement.createdAt),
    settledAt: settlement.settledAt ? Timestamp.fromDate(settlement.settledAt) : null
  });
  return docRef.id;
};

export const getTripSettlements = async (tripId: string): Promise<Settlement[]> => {
  const q = query(
    collection(db, 'settlements'),
    where('tripId', '==', tripId),
    orderBy('createdAt', 'desc')
  );
  
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    createdAt: doc.data().createdAt.toDate(),
    settledAt: doc.data().settledAt?.toDate()
  })) as Settlement[];
};

export const markSettlementAsSettled = async (settlementId: string): Promise<void> => {
  const settlementRef = doc(db, 'settlements', settlementId);
  await updateDoc(settlementRef, {
    settled: true,
    settledAt: Timestamp.now()
  });
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