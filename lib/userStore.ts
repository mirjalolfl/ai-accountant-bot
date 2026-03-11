// lib/userStore.ts
import { db } from "./firebase";
import {
  UserProfile,
  Debt,
  Expense,
  ConversationMessage,
  FinancialSummary,
} from "../types";
import { v4 as uuidv4 } from "uuid";

// ─── USER ───────────────────────────────────────────────────────────────────

export async function getOrCreateUser(
  telegramId: number,
  firstName: string,
  username?: string
): Promise<UserProfile> {
  const ref = db.collection("users").doc(String(telegramId));
  const snap = await ref.get();

  if (snap.exists) {
    await ref.update({ lastActiveAt: new Date().toISOString() });
    return snap.data() as UserProfile;
  }

  const user: UserProfile = {
    telegramId,
    firstName,
    username,
    currency: "UZS",
    createdAt: new Date().toISOString(),
    lastActiveAt: new Date().toISOString(),
  };

  await ref.set(user);
  return user;
}

export async function updateUserCurrency(
  telegramId: number,
  currency: string
): Promise<void> {
  await db.collection("users").doc(String(telegramId)).update({ currency });
}

export async function updateMonthlyBudget(
  telegramId: number,
  budget: number
): Promise<void> {
  await db.collection("users").doc(String(telegramId)).update({ monthlyBudget: budget });
}

// ─── DEBTS ──────────────────────────────────────────────────────────────────

export async function addDebt(
  telegramId: number,
  debt: Omit<Debt, "id" | "createdAt" | "isPaid">
): Promise<Debt> {
  const newDebt: Debt = {
    ...debt,
    id: uuidv4(),
    isPaid: false,
    createdAt: new Date().toISOString(),
  };

  await db
    .collection("users")
    .doc(String(telegramId))
    .collection("debts")
    .doc(newDebt.id)
    .set(newDebt);

  return newDebt;
}

export async function getDebts(
  telegramId: number,
  onlyActive = false
): Promise<Debt[]> {
  const snap = await db
    .collection("users")
    .doc(String(telegramId))
    .collection("debts")
    .orderBy("createdAt", "desc")
    .get();

  const debts = snap.docs.map((d) => d.data() as Debt);
  if (onlyActive) return debts.filter((d) => !d.isPaid);
  return debts;
}

export async function markDebtPaid(
  telegramId: number,
  debtId: string
): Promise<void> {
  await db
    .collection("users")
    .doc(String(telegramId))
    .collection("debts")
    .doc(debtId)
    .update({ isPaid: true, paidAt: new Date().toISOString() });
}

export async function deleteDebt(
  telegramId: number,
  debtId: string
): Promise<void> {
  await db
    .collection("users")
    .doc(String(telegramId))
    .collection("debts")
    .doc(debtId)
    .delete();
}

export async function updateDebt(
  telegramId: number,
  debtId: string,
  updates: Partial<Debt>
): Promise<void> {
  await db
    .collection("users")
    .doc(String(telegramId))
    .collection("debts")
    .doc(debtId)
    .update(updates);
}

// ─── EXPENSES ───────────────────────────────────────────────────────────────

export async function addExpense(
  telegramId: number,
  expense: Omit<Expense, "id" | "date">
): Promise<Expense> {
  const newExpense: Expense = {
    ...expense,
    id: uuidv4(),
    date: new Date().toISOString(),
  };

  await db
    .collection("users")
    .doc(String(telegramId))
    .collection("expenses")
    .doc(newExpense.id)
    .set(newExpense);

  return newExpense;
}

export async function getExpenses(
  telegramId: number,
  month?: string
): Promise<Expense[]> {
  const snap = await db
    .collection("users")
    .doc(String(telegramId))
    .collection("expenses")
    .orderBy("date", "desc")
    .get();

  const expenses = snap.docs.map((d) => d.data() as Expense);
  if (month) return expenses.filter((e) => e.date.startsWith(month));
  return expenses;
}

// ─── FINANCIAL SUMMARY ──────────────────────────────────────────────────────

export async function getFinancialSummary(
  telegramId: number
): Promise<FinancialSummary> {
  const userSnap = await db.collection("users").doc(String(telegramId)).get();
  const profile = userSnap.data() as UserProfile;

  const debts = await getDebts(telegramId, true);
  const today = new Date().toISOString().split("T")[0];

  const totalBorrowed = debts
    .filter((d) => d.type === "borrowed")
    .reduce((sum, d) => sum + d.amount, 0);

  const totalLent = debts
    .filter((d) => d.type === "lent")
    .reduce((sum, d) => sum + d.amount, 0);

  const overdueDebts = debts.filter(
    (d) => d.dueDate && d.dueDate < today && !d.isPaid
  );

  return {
    totalBorrowed,
    totalLent,
    netBalance: totalLent - totalBorrowed,
    activeDebts: debts,
    overdueDebts,
    currency: profile?.currency || "UZS",
  };
}

// ─── CONVERSATION HISTORY ───────────────────────────────────────────────────

const MAX_HISTORY = 20;

export async function saveMessage(
  telegramId: number,
  message: Omit<ConversationMessage, "timestamp">
): Promise<void> {
  const msg: ConversationMessage = {
    ...message,
    timestamp: new Date().toISOString(),
  };

  const historyRef = db
    .collection("users")
    .doc(String(telegramId))
    .collection("history")
    .doc("messages");

  const snap = await historyRef.get();
  let messages: ConversationMessage[] = snap.exists
    ? (snap.data()?.messages as ConversationMessage[]) || []
    : [];

  messages.push(msg);
  if (messages.length > MAX_HISTORY) messages = messages.slice(-MAX_HISTORY);

  await historyRef.set({ messages });
}

export async function getConversationHistory(
  telegramId: number
): Promise<ConversationMessage[]> {
  const snap = await db
    .collection("users")
    .doc(String(telegramId))
    .collection("history")
    .doc("messages")
    .get();

  if (!snap.exists) return [];
  return (snap.data()?.messages as ConversationMessage[]) || [];
}

export async function clearHistory(telegramId: number): Promise<void> {
  await db
    .collection("users")
    .doc(String(telegramId))
    .collection("history")
    .doc("messages")
    .delete();
}
