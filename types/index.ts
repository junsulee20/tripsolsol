export interface User {
  id: string;
  email: string;
  name: string;
  profileImage?: string;
  createdAt: Date;
  settings?: {
    displayName?: string;
    notifications?: {
      email?: boolean;
      push?: boolean;
      tripUpdates?: boolean;
      expenseUpdates?: boolean;
      settlementUpdates?: boolean;
    };
    darkMode?: boolean;
    locationServices?: boolean;
    // 추가 설정이 필요한 경우 여기에 추가
  };
}

export interface Trip {
  id: string;
  name: string;
  description?: string;
  emoji?: string;
  startDate: Date;
  endDate: Date;
  participants: string[]; // User IDs
  createdBy: string; // User ID
  createdAt: Date;
  currency: string;
  totalAmount: number;
}

export interface Expense {
  id: string;
  tripId: string;
  title: string;
  description?: string;
  amount: number;
  currency: string;
  paidBy: string; // User ID
  splitBetween: string[]; // User IDs
  category: ExpenseCategory;
  date: Date;
  receipt?: string; // Image URL
  createdAt: Date;
}

export interface Settlement {
  id: string;
  tripId: string;
  from: string; // User ID
  to: string; // User ID
  amount: number;
  currency: string;
  settled: boolean;
  settledAt?: Date;
  createdAt: Date;
}

export enum ExpenseCategory {
  FOOD = 'food',
  TRANSPORT = 'transport',
  ACCOMMODATION = 'accommodation',
  ENTERTAINMENT = 'entertainment',
  SHOPPING = 'shopping',
  OTHER = 'other'
}

export interface Balance {
  userId: string;
  amount: number; // positive = owes money, negative = is owed money
}

export interface TripSummary {
  trip: Trip;
  totalExpenses: number;
  balances: Balance[];
  settlements: Settlement[];
} 