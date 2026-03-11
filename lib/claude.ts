// lib/claude.ts
import Anthropic from "@anthropic-ai/sdk";
import {
  addDebt,
  getDebts,
  markDebtPaid,
  deleteDebt,
  updateDebt,
  addExpense,
  getExpenses,
  getFinancialSummary,
  updateUserCurrency,
  updateMonthlyBudget,
} from "./userStore";
import { ConversationMessage } from "../types";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

// ─── CLAUDE TOOLS ────────────────────────────────────────────────────────────

const TOOLS: Anthropic.Tool[] = [
  {
    name: "add_debt",
    description: "Yangi qarz yozuvini qo'shish. Foydalanuvchi qarz olgan yoki bergan bo'lsa ishlatiladi.",
    input_schema: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["borrowed", "lent"], description: "'borrowed' = foydalanuvchi qarz oldi, 'lent' = foydalanuvchi qarz berdi" },
        amount: { type: "number", description: "Qarz miqdori" },
        currency: { type: "string", description: "Valyuta: UZS, USD, EUR, RUB. Default: UZS" },
        person: { type: "string", description: "Kim bilan" },
        description: { type: "string", description: "Qarz sababi" },
        dueDate: { type: "string", description: "To'lash muddati YYYY-MM-DD (ixtiyoriy)" },
      },
      required: ["type", "amount", "currency", "person", "description"],
    },
  },
  {
    name: "get_debts",
    description: "Foydalanuvchining qarzlari ro'yxatini olish",
    input_schema: {
      type: "object",
      properties: {
        onlyActive: { type: "boolean", description: "true = faqat to'lanmagan" },
      },
      required: [],
    },
  },
  {
    name: "mark_debt_paid",
    description: "Qarzni to'langan deb belgilash",
    input_schema: {
      type: "object",
      properties: { debtId: { type: "string", description: "Qarz ID'si" } },
      required: ["debtId"],
    },
  },
  {
    name: "delete_debt",
    description: "Qarz yozuvini o'chirish",
    input_schema: {
      type: "object",
      properties: { debtId: { type: "string", description: "Qarz ID'si" } },
      required: ["debtId"],
    },
  },
  {
    name: "update_debt",
    description: "Mavjud qarz ma'lumotlarini yangilash",
    input_schema: {
      type: "object",
      properties: {
        debtId: { type: "string" },
        amount: { type: "number" },
        dueDate: { type: "string" },
        description: { type: "string" },
        person: { type: "string" },
      },
      required: ["debtId"],
    },
  },
  {
    name: "add_expense",
    description: "Xarajat yozuvini qo'shish",
    input_schema: {
      type: "object",
      properties: {
        amount: { type: "number" },
        currency: { type: "string" },
        category: { type: "string", description: "oziq-ovqat, transport, kiyim, sog'liq, o'yin-kulgi, kommunal, ta'lim, biznes, boshqa" },
        description: { type: "string" },
      },
      required: ["amount", "currency", "category", "description"],
    },
  },
  {
    name: "get_expenses",
    description: "Xarajatlar ro'yxatini olish",
    input_schema: {
      type: "object",
      properties: {
        month: { type: "string", description: "YYYY-MM formatida (ixtiyoriy)" },
      },
      required: [],
    },
  },
  {
    name: "get_financial_summary",
    description: "Moliyaviy umumiy holat: jami qarzlar, balans, muddati o'tgan qarzlar",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "set_currency",
    description: "Foydalanuvchining asosiy valyutasini o'zgartirish",
    input_schema: {
      type: "object",
      properties: { currency: { type: "string", description: "UZS, USD, EUR va h.k." } },
      required: ["currency"],
    },
  },
  {
    name: "set_monthly_budget",
    description: "Oylik byudjet limitini belgilash",
    input_schema: {
      type: "object",
      properties: { budget: { type: "number" } },
      required: ["budget"],
    },
  },
];

// ─── SYSTEM PROMPT ───────────────────────────────────────────────────────────

function buildSystemPrompt(userName: string, summaryText: string): string {
  const today = new Date().toLocaleDateString("uz-UZ", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  return `Siz ${userName} ismli foydalanuvchining shaxsiy AI buxgalteri va moliyaviy maslahatchisiniz.

📅 Bugun: ${today}

## Vazifalaringiz:
1. Qarzlarni boshqarish — qarz olindi/berilganda zudlik bilan ro'yxatga olish
2. Xarajatlarni kuzatish — kundalik xarajatlarni kategoriya bo'yicha yozish
3. Eslatmalar — muddati yaqin yoki o'tgan qarzlar haqida ogohlantirish
4. Moliyaviy tavsiyalar — tejamkorlik, byudjet rejalashtirish
5. Hisobotlar — moliyaviy holat tahlili

## Joriy moliyaviy holat:
${summaryText || "Hali ma'lumot yo'q."}

## Muhim qoidalar:
- Doimo o'zbek tilida gaplashing
- Foydalanuvchi qarz haqida biror narsa aytsa — darhol tool orqali saqlang
- Qarz saqlangandan keyin tasdiqlang: "✅ Yozib oldim!"
- Muddati o'tgan qarzlar bo'lsa — har doim eslatib turing
- Emoji'lardan o'rinli foydalaning
- Qisqa, aniq javoblar bering
- Noaniqlik bo'lsa — aniqlashtiring, tahmin qilmang`;
}

// ─── TOOL EXECUTOR ───────────────────────────────────────────────────────────

async function executeTool(
  telegramId: number,
  toolName: string,
  toolInput: Record<string, unknown>
): Promise<string> {
  try {
    switch (toolName) {
      case "add_debt": {
        const debt = await addDebt(telegramId, toolInput as any);
        return JSON.stringify({ success: true, debt });
      }
      case "get_debts": {
        const debts = await getDebts(telegramId, (toolInput.onlyActive as boolean) ?? true);
        return JSON.stringify({ debts, count: debts.length });
      }
      case "mark_debt_paid": {
        await markDebtPaid(telegramId, toolInput.debtId as string);
        return JSON.stringify({ success: true });
      }
      case "delete_debt": {
        await deleteDebt(telegramId, toolInput.debtId as string);
        return JSON.stringify({ success: true });
      }
      case "update_debt": {
        const { debtId, ...updates } = toolInput as any;
        await updateDebt(telegramId, debtId, updates);
        return JSON.stringify({ success: true });
      }
      case "add_expense": {
        const expense = await addExpense(telegramId, toolInput as any);
        return JSON.stringify({ success: true, expense });
      }
      case "get_expenses": {
        const expenses = await getExpenses(telegramId, toolInput.month as string | undefined);
        return JSON.stringify({ expenses, count: expenses.length });
      }
      case "get_financial_summary": {
        const summary = await getFinancialSummary(telegramId);
        return JSON.stringify(summary);
      }
      case "set_currency": {
        await updateUserCurrency(telegramId, toolInput.currency as string);
        return JSON.stringify({ success: true });
      }
      case "set_monthly_budget": {
        await updateMonthlyBudget(telegramId, toolInput.budget as number);
        return JSON.stringify({ success: true });
      }
      default:
        return JSON.stringify({ error: `Noma'lum tool: ${toolName}` });
    }
  } catch (error) {
    console.error(`Tool error [${toolName}]:`, error);
    return JSON.stringify({ error: String(error) });
  }
}

// ─── MAIN: CHAT ──────────────────────────────────────────────────────────────

export async function chat(
  telegramId: number,
  userName: string,
  userMessage: string,
  history: ConversationMessage[]
): Promise<string> {
  let summaryText = "";
  try {
    const summary = await getFinancialSummary(telegramId);
    summaryText = `- Faol qarzlar: ${summary.activeDebts.length} ta | Muddati o'tgan: ${summary.overdueDebts.length} ta
- Men qarz oldim: ${summary.totalBorrowed.toLocaleString()} ${summary.currency}
- Men qarz berdim: ${summary.totalLent.toLocaleString()} ${summary.currency}
- Balans: ${summary.netBalance >= 0 ? "+" : ""}${summary.netBalance.toLocaleString()} ${summary.currency}`;
  } catch { /* yangi foydalanuvchi */ }

  const messages: Anthropic.MessageParam[] = [
    ...history.map((msg) => ({ role: msg.role as "user" | "assistant", content: msg.content })),
    { role: "user" as const, content: userMessage },
  ];

  let response = await client.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 1500,
    system: buildSystemPrompt(userName, summaryText),
    tools: TOOLS,
    messages,
  });

  // Tool use loop
  while (response.stop_reason === "tool_use") {
    const toolUseBlocks = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
    );

    const toolResults: Anthropic.ToolResultBlockParam[] = await Promise.all(
      toolUseBlocks.map(async (tool) => ({
        type: "tool_result" as const,
        tool_use_id: tool.id,
        content: await executeTool(telegramId, tool.name, tool.input as Record<string, unknown>),
      }))
    );

    messages.push({ role: "assistant", content: response.content });
    messages.push({ role: "user", content: toolResults });

    response = await client.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 1500,
      system: buildSystemPrompt(userName, summaryText),
      tools: TOOLS,
      messages,
    });
  }

  const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === "text");
  return textBlock?.text || "Kechirasiz, javob shakllantirishda xatolik yuz berdi.";
}
