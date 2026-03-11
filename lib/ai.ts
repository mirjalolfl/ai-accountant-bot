// lib/ai.ts — OpenAI GPT bilan suhbat va tool use
import OpenAI from "openai";
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

const openai = new OpenAI({
  baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
  apiKey: process.env.GEMINI_API_KEY!,
});

// ─── TOOLS (OpenAI function calling) ────────────────────────────────────────

const TOOLS: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "add_debt",
      description: "Yangi qarz yozuvini qo'shish. Foydalanuvchi qarz olgan yoki bergan bo'lsa ishlatiladi.",
      parameters: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["borrowed", "lent"], description: "'borrowed'=qarz oldi, 'lent'=qarz berdi" },
          amount: { type: "number", description: "Qarz miqdori" },
          currency: { type: "string", description: "Valyuta: UZS, USD, EUR. Default: UZS" },
          person: { type: "string", description: "Kim bilan" },
          description: { type: "string", description: "Qarz sababi" },
          dueDate: { type: "string", description: "To'lash muddati YYYY-MM-DD (ixtiyoriy)" },
        },
        required: ["type", "amount", "currency", "person", "description"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_debts",
      description: "Foydalanuvchining qarzlari ro'yxatini olish",
      parameters: {
        type: "object",
        properties: {
          onlyActive: { type: "boolean", description: "true=faqat to'lanmagan" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "mark_debt_paid",
      description: "Qarzni to'langan deb belgilash",
      parameters: {
        type: "object",
        properties: { debtId: { type: "string" } },
        required: ["debtId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_debt",
      description: "Qarz yozuvini o'chirish",
      parameters: {
        type: "object",
        properties: { debtId: { type: "string" } },
        required: ["debtId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_debt",
      description: "Mavjud qarz ma'lumotlarini yangilash",
      parameters: {
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
  },
  {
    type: "function",
    function: {
      name: "add_expense",
      description: "Xarajat yozuvini qo'shish",
      parameters: {
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
  },
  {
    type: "function",
    function: {
      name: "get_expenses",
      description: "Xarajatlar ro'yxatini olish",
      parameters: {
        type: "object",
        properties: {
          month: { type: "string", description: "YYYY-MM formatida (ixtiyoriy)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_financial_summary",
      description: "Moliyaviy umumiy holat: jami qarzlar, balans, muddati o'tgan qarzlar",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "set_currency",
      description: "Foydalanuvchining asosiy valyutasini o'zgartirish",
      parameters: {
        type: "object",
        properties: { currency: { type: "string" } },
        required: ["currency"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "set_monthly_budget",
      description: "Oylik byudjet limitini belgilash",
      parameters: {
        type: "object",
        properties: { budget: { type: "number" } },
        required: ["budget"],
      },
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
- Foydalanuvchi qarz haqida biror narsa aytsa — darhol function call orqali saqlang
- Qarz saqlangandan keyin tasdiqlang: "✅ Yozib oldim!"
- Muddati o'tgan qarzlar bo'lsa — har doim eslatib turing
- Emoji'lardan o'rinli foydalaning
- Qisqa, aniq javoblar bering`;
}

// ─── TOOL EXECUTOR ───────────────────────────────────────────────────────────

async function executeTool(
  telegramId: number,
  name: string,
  args: Record<string, unknown>
): Promise<string> {
  try {
    switch (name) {
      case "add_debt": return JSON.stringify(await addDebt(telegramId, args as any));
      case "get_debts": return JSON.stringify(await getDebts(telegramId, (args.onlyActive as boolean) ?? true));
      case "mark_debt_paid": await markDebtPaid(telegramId, args.debtId as string); return JSON.stringify({ success: true });
      case "delete_debt": await deleteDebt(telegramId, args.debtId as string); return JSON.stringify({ success: true });
      case "update_debt": { const { debtId, ...rest } = args as any; await updateDebt(telegramId, debtId, rest); return JSON.stringify({ success: true }); }
      case "add_expense": return JSON.stringify(await addExpense(telegramId, args as any));
      case "get_expenses": return JSON.stringify(await getExpenses(telegramId, args.month as string | undefined));
      case "get_financial_summary": return JSON.stringify(await getFinancialSummary(telegramId));
      case "set_currency": await updateUserCurrency(telegramId, args.currency as string); return JSON.stringify({ success: true });
      case "set_monthly_budget": await updateMonthlyBudget(telegramId, args.budget as number); return JSON.stringify({ success: true });
      default: return JSON.stringify({ error: `Noma'lum tool: ${name}` });
    }
  } catch (e) {
    return JSON.stringify({ error: String(e) });
  }
}

// ─── MAIN CHAT ───────────────────────────────────────────────────────────────

export async function chat(
  telegramId: number,
  userName: string,
  userMessage: string,
  history: ConversationMessage[]
): Promise<string> {
  let summaryText = "";
  try {
    const s = await getFinancialSummary(telegramId);
    summaryText = `- Faol qarzlar: ${s.activeDebts.length} ta | Muddati o'tgan: ${s.overdueDebts.length} ta\n- Men qarz oldim: ${s.totalBorrowed.toLocaleString()} ${s.currency}\n- Men qarz berdim: ${s.totalLent.toLocaleString()} ${s.currency}\n- Balans: ${s.netBalance >= 0 ? "+" : ""}${s.netBalance.toLocaleString()} ${s.currency}`;
  } catch { /* yangi foydalanuvchi */ }

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: buildSystemPrompt(userName, summaryText) },
    ...history.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    { role: "user", content: userMessage },
  ];

  // Tool use loop
  while (true) {
    const response = await openai.chat.completions.create({
      model: "gemini-2.5-flash",
      messages,
      tools: TOOLS,
      tool_choice: "auto",
      max_tokens: 1500,
    });

    const choice = response.choices[0];
    const msg = choice.message;
    messages.push(msg);

    // Tool chaqirilmasa — matn javobni qaytarish
    if (choice.finish_reason !== "tool_calls" || !msg.tool_calls?.length) {
      return msg.content || "Kechirasiz, javob shakllantirishda xatolik yuz berdi.";
    }

    // Har bir tool ni bajarish
    for (const toolCall of msg.tool_calls) {
      const args = JSON.parse(toolCall.function.arguments || "{}");
      const result = await executeTool(telegramId, toolCall.function.name, args);
      messages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: result,
      });
    }
  }
}
