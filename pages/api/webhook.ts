// pages/api/webhook.ts
import type { NextApiRequest, NextApiResponse } from "next";
import {
  getOrCreateUser,
  saveMessage,
  getConversationHistory,
  clearHistory,
} from "../../lib/userStore";
import { chat } from "../../lib/claude";

// Vercel serverless da response yuborgandan keyin funksiya to'xtashi mumkin.
// Shuning uchun BARCHA ishlov AVVAL, res.status(200) ENG OXIRDA yuboriladi.
// Telegram 60 sekundgacha kutadi — bu vaqt yetarli.

async function sendTelegramMessage(chatId: number, text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN!;
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error("sendMessage error:", err);
  }
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
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Secret token tekshiruvi
  const secretToken = req.headers["x-telegram-bot-api-secret-token"];
  if (
    process.env.TELEGRAM_WEBHOOK_SECRET &&
    secretToken !== process.env.TELEGRAM_WEBHOOK_SECRET
  ) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const message = req.body?.message;

  // Faqat shaxsiy suhbatda ishlash (Privacy uchun)
  if (message.chat.type !== "private") {
    await sendTelegramMessage(
      message.chat.id,
      "🛡 <b>Xavfsizlik ogohlantirishi:</b>\n\nMen sizning shaxsiy AI buxgalteringizman. Moliyaviy ma'lumotlaringiz xavfsizligi uchun meni faqat <b>shaxsiy chatda</b> ishlating.\n\nGuruhlarda ishlashim cheklangan. Iltimos, menga to'g'ridan-to'g'ri yozing: @shaxsiy_buxalter_bot" // Bot username'ini user o'zi qo'yadi, bu yerda misol
    );
    return res.status(200).json({ ok: true });
  }

  // Matn bo'lmasa — darhol 200 qaytarish
  if (!message || !message.text) {
    return res.status(200).json({ ok: true });
  }

  const chatId: number = message.chat.id;
  const text: string = message.text.trim();
  const firstName: string = message.from?.first_name || "Foydalanuvchi";
  const username: string | undefined = message.from?.username;
  const telegramId: number = message.from?.id || chatId;

  try {
    await getOrCreateUser(telegramId, firstName, username);

    // /start
    if (text === "/start") {
      await sendTelegramMessage(
        chatId,
        `👋 Salom, <b>${firstName}</b>!\n\nMen sizning shaxsiy AI buxgalteringizman 📊\n\n<b>Nima qila olaman?</b>\n💰 Qarzlarni yozib borish (olgan/bergan)\n📝 Xarajatlarni kuzatish\n⏰ Muddati kelgan qarzlarni eslatish\n📈 Moliyaviy tavsiyalar\n📊 Oylik hisobot\n\n<b>Misol:</b>\n• <i>"Akamdan 500,000 so'm qarz oldim"</i>\n• <i>"Sherzodga 1 mln berdim, oydan keyin qaytaradi"</i>\n• <i>"Bugun taomga 80,000 sarfladim"</i>\n\n/summary /debts /expenses /help /clear`
      );
      return res.status(200).json({ ok: true });
    }

    // /help
    if (text === "/help") {
      await sendTelegramMessage(
        chatId,
        `🤖 <b>AI Buxgalter — Yordam</b>\n\n<b>📌 Qarz:</b>\n• "Akadan 200,000 qarz oldim"\n• "Sherzodga 1 mln berdim 1 oyga"\n• "Qarzlarimni ko'rsat"\n• "Akaning qarzini to'ldim"\n\n<b>💸 Xarajat:</b>\n• "Bugun oziq-ovqatga 150,000 sarfladim"\n• "Bu oy xarajatlarimni ko'rsat"\n\n<b>📊 Hisobotlar:</b>\n• "Moliyaviy holatimni ko'rsat"\n• "Qaysi qarzning muddati o'tgan?"\n\n<b>Buyruqlar:</b>\n/summary /debts /expenses /clear`
      );
      return res.status(200).json({ ok: true });
    }

    // /clear
    if (text === "/clear") {
      await clearHistory(telegramId);
      await sendTelegramMessage(chatId, "🗑 Suhbat tarixi tozalandi.");
      return res.status(200).json({ ok: true });
    }

    // Buyruqlarni matn ga aylantirish
    let userInput = text;
    if (text === "/summary") userInput = "Mening umumiy moliyaviy holatimni batafsil ko'rsat";
    else if (text === "/debts") userInput = "Barcha faol qarzlarimni ko'rsat";
    else if (text === "/expenses") userInput = "Bu oygi xarajatlarimni ko'rsat";

    // Typing ko'rsatish
    await sendTypingAction(chatId);

    // Claude bilan suhbat
    const history = await getConversationHistory(telegramId);
    const aiReply = await chat(telegramId, firstName, userInput, history);

    // Suhbat tarixiga saqlash
    await saveMessage(telegramId, { role: "user", content: userInput });
    await saveMessage(telegramId, { role: "assistant", content: aiReply });

    // Foydalanuvchiga javob
    await sendTelegramMessage(chatId, aiReply);

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("Webhook handler error:", error);
    try {
      await sendTelegramMessage(
        chatId,
        "⚠️ Xatolik yuz berdi. Iltimos, keyinroq urinib ko'ring."
      );
    } catch {
      // silent
    }
    return res.status(200).json({ ok: true });
  }
}
