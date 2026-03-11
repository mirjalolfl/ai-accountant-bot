// Webhookni o'rnatish uchun bir marta ishga tushiring:
// node scripts/setup-webhook.js https://your-app.vercel.app

require("dotenv").config({ path: ".env.local" });

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WEBHOOK_URL = process.argv[2] || process.env.VERCEL_URL;
const SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;

if (!BOT_TOKEN || !WEBHOOK_URL) {
  console.error("Kerak: TELEGRAM_BOT_TOKEN va Vercel URL");
  console.error("Ishlatish: node scripts/setup-webhook.js https://your-app.vercel.app");
  process.exit(1);
}

async function setup() {
  const url = `${WEBHOOK_URL.replace(/\/$/, "")}/api/webhook`;
  console.log(`🔗 Webhook o'rnatilmoqda: ${url}`);

  const params = new URLSearchParams({ url, allowed_updates: JSON.stringify(["message"]) });
  if (SECRET) params.append("secret_token", SECRET);

  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook?${params}`);
  const data = await res.json();

  if (data.ok) {
    console.log("✅ Webhook muvaffaqiyatli o'rnatildi!");
  } else {
    console.error("❌ Xatolik:", data.description);
  }

  const info = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`);
  const infoData = await info.json();
  console.log("\n📊 Holat:", JSON.stringify(infoData.result, null, 2));
}

setup().catch(console.error);
