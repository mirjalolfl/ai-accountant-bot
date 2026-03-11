// pages/api/setup.ts
// Bu endpoint webhookni o'rnatish uchun bir marta chaqiriladi
// Ishlatilgandan keyin avtomatik o'chirilishi mumkin

import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const appUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : req.headers.host
    ? `https://${req.headers.host}`
    : null;

  if (!token) return res.status(500).json({ error: "TELEGRAM_BOT_TOKEN topilmadi" });
  if (!appUrl) return res.status(500).json({ error: "App URL aniqlanmadi" });

  const webhookUrl = `${appUrl}/api/webhook`;

  const params = new URLSearchParams({
    url: webhookUrl,
    allowed_updates: JSON.stringify(["message"]),
    drop_pending_updates: "true",
  });

  if (secret) params.append("secret_token", secret);

  try {
    // Webhookni o'rnatish
    const setRes = await fetch(
      `https://api.telegram.org/bot${token}/setWebhook?${params}`
    );
    const setData = await setRes.json();

    // Natijani tekshirish
    const infoRes = await fetch(
      `https://api.telegram.org/bot${token}/getWebhookInfo`
    );
    const infoData = await infoRes.json();

    // Bot ma'lumotlarini olish
    const meRes = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const meData = await meRes.json();

    return res.status(200).json({
      success: setData.ok,
      message: setData.description || "Webhook o'rnatildi",
      webhookUrl,
      bot: meData.result ? {
        username: meData.result.username,
        name: meData.result.first_name,
        id: meData.result.id,
      } : null,
      webhookInfo: infoData.result,
    });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
}
