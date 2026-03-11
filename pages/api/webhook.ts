// pages/api/webhook.ts
import type { NextApiRequest, NextApiResponse } from "next";
import {
  getOrCreateUser,
  saveMessage,
  getConversationHistory,
  clearHistory,
} from "../../lib/userStore";
import { chat } from "../../lib/claude";

async function sendTelegramMessage(chatId: number, text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN!;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });
}

async function sendTypingAction(chatId: number): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN!;
  await fetch(`https://api.telegram.org/bot${token}/sendChatAction`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, action: "typing" }),
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const secretToken = req.headers["x-telegram-bot-api-secret-token"];
  if (process.env.TELEGRAM_WEBHOOK_SECRET && secretToken !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // Vercel dan zudlik bilan 200 qaytarish
  res.status(200).json({ ok: true });

  const message = req.body?.message;
  if (!message || !message.text) return;

  const chatId: number = message.chat.id;
  const text: string = message.text.trim();
  const firstName: string = message.from?.first_name || "Foydalanuvchi";
  const username: string | undefined = message.from?.username;
  const telegramId: number = message.from?.id || chatId;

  try {
    await getOrCreateUser(telegramId, firstName, username);
    await sendTypingAction(chatId);

    // Oddiy buyruqlar
    if (text === "/start") {
      await sendTelegramMessage(chatId,
        `👋 Salom, <b>${firstName}</b>!\n\nMen sizning shaxsiy AI buxgalteringizman 📊\n\n<b>Nima qila olaman?</b>\n💰 Qarzlarni yozib borish (olgan/bergan)\n📝 Xarajatlarni kuzatish\n⏰ Muddati kelgan qarzlarni eslatish\n📈 Moliyaviy tavsiyalar\n📊 Oylik hisobot\n\n<b>Misol:</b>\n• <i>"Akamdan 500,000 so'm qarz oldim"</i>\n• <i>"Sherzodga 1 mln berdim, oydan keyin qaytaradi"</i>\n• <i>"Bugun taomga 80,000 sarfladim"</i>\n\n/summary /debts /expenses /help /clear`
      );
      return;
    }

    if (text === "/help") {
      await sendTelegramMessage(chatId,
        `🤖 <b>AI Buxgalter — Yordam</b>\n\n<b>📌 Qarz:</b>\n• "Akadan 200,000 qarz oldim"\n• "Sherzodga 1 mln berdim 1 oyga"\n• "Qarzlarimni ko'rsat"\n• "Akaning qarzini to'ldim"\n\n<b>💸 Xarajat:</b>\n• "Bugun oziq-ovqatga 150,000 sarfladim"\n• "Bu oy xarajatlarimni ko'rsat"\n\n<b>📊 Hisobotlar:</b>\n• "Moliyaviy holatimni ko'rsat"\n• "Qaysi qarzning muddati o'tgan?"\n\n<b>Buyruqlar:</b>\n/summary /debts /expenses /clear`
      );
      return;
    }

    if (text === "/clear") {
      await clearHistory(telegramId);
      await sendTelegramMessage(chatId, "🗑 Suhbat tarixi tozalandi.");
      return;
    }

    let userInput = text;
    if (text === "/summary") userInput = "Mening umumiy moliyaviy holatimni batafsil ko'rsat";
    else if (text === "/debts") userInput = "Barcha faol qarzlarimni ko'rsat";
    else if (text === "/expenses") userInput = "Bu oygi xarajatlarimni ko'rsat";

    const history = await getConversationHistory(telegramId);
    const aiReply = await chat(telegramId, firstName, userInput, history);

    await saveMessage(telegramId, { role: "user", content: userInput });
    await saveMessage(telegramId, { role: "assistant", content: aiReply });

    await sendTelegramMessage(chatId, aiReply);
  } catch (error) {
    console.error("Webhook error:", error);
    try {
      await sendTelegramMessage(chatId, "⚠️ Xatolik yuz berdi. Iltimos, keyinroq urinib ko'ring.");
    } catch { /* silent */ }
  }
}
