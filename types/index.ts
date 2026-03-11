// types/index.ts

export interface Debt {
  id: string;
  type: "borrowed" | "lent"; // "borrowed" = men qarz oldim, "lent" = men qarz berdim
  amount: number;
  currency: string;
  person: string;       // kim bilan
  description: string;  // nima uchun
  dueDate?: string;     // to'lash muddati (ISO string)
  isPaid: boolean;
  createdAt: string;
  paidAt?: string;
}

export interface Expense {
  id: string;
  amount: number;
  currency: string;
  category: string;
  description: string;
  date: string;
}

export interface UserProfile {
  telegramId: number;
  firstName: string;
  username?: string;
  currency: string;       // asosiy valyuta (default: "UZS")
  monthlyBudget?: number;
  createdAt: string;
  lastActiveAt: string;
}

export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export interface FinancialSummary {
  totalBorrowed: number;     // men qarz oldim jami
  totalLent: number;         // men qarz berdim jami
  netBalance: number;        // lent - borrowed
  activeDebts: Debt[];
  overdueDebts: Debt[];
  currency: string;
}
