export interface User {
  id: string;
  email: string;
  name: string;
  profileImage?: string;
  photoURL?: string;
  bankAccount?: string;
  createdAt: Date;
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
  splitDetails?: ExpenseSplit[]; // 각 멤버별 상세 분할 정보
  splitMethod?: string; // 분할 방법 ('equal', 'unequal', 'custom')
  category: ExpenseCategory;
  date: Date;
  receipt?: string; // Image URL
  createdAt: Date;
}

export interface ExpenseSplit {
  userId: string;
  amount: number;
  percentage: number;
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

export interface ExchangeRate {
  cur_unit: string;
  cur_nm: string;
  kftc_deal_bas_r: string;
  ttb: string;
  tts: string;
  deal_bas_r: string;
}

export interface ExchangeRateAPIResponse {
  result: string;
  documentation: string;
  terms_of_use: string;
  time_last_update_unix: number;
  time_last_update_utc: string;
  time_next_update_unix: number;
  time_next_update_utc: string;
  base_code: string;
  conversion_rates: {
    [currency: string]: number;
  };
}

export interface ExchangeRateResponse {
  cur_unit: string;        // 통화 코드 (USD, EUR 등)
  cur_nm: string;          // 통화 이름 (미국 달러, 유로 등)
  kftc_deal_bas_r: string; // 매매기준율 (문자열로 유지)
  result: number;
  ttb: string;
  tts: string;
  deal_bas_r: string;
  bkpr: string;
  yy_efee_r: string;
  ten_dd_efee_r: string;
  kftc_bkpr: string;
} 