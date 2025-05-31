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
  const user: User = {
    id: 'mock-user-id',
    email,
    name,
    createdAt: new Date()
  };
  return user;
};

export const signIn = async (email: string, password: string): Promise<any> => {
  return { uid: 'mock-user-id', email };
};

export const logout = async (): Promise<void> => {
  // Mock logout
};

export const updateUserProfile = async (updates: { displayName?: string; photoURL?: string }): Promise<void> => {
  // Mock update
};

// User Services
export const getUserById = async (userId: string): Promise<User | null> => {
  return {
    id: userId,
    email: 'mock@example.com',
    name: 'Mock User',
    createdAt: new Date()
  };
};

export const getUsersByIds = async (userIds: string[]): Promise<User[]> => {
  return userIds.map(id => ({
    id,
    email: `user${id}@example.com`,
    name: `User ${id}`,
    createdAt: new Date()
  }));
};

// Trip Services
export const createTrip = async (trip: Omit<Trip, 'id'>): Promise<string> => {
  const newTrip = {
    ...trip,
    id: `trip-${Date.now()}`
  };
  mockTrips.push(newTrip);
  return newTrip.id;
};

export const getUserTrips = async (userId: string): Promise<Trip[]> => {
  return mockTrips;
};

export const getTripById = async (tripId: string): Promise<Trip | null> => {
  return mockTrips.find(trip => trip.id === tripId) || null;
};

// Expense Services
export const addExpense = async (expense: Omit<Expense, 'id'>): Promise<string> => {
  return `expense-${Date.now()}`;
};

export const getTripExpenses = async (tripId: string): Promise<Expense[]> => {
  return [];
};

export const updateExpense = async (expenseId: string, updates: Partial<Expense>): Promise<void> => {
  // Mock update
};

export const deleteExpense = async (expenseId: string): Promise<void> => {
  // Mock delete
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