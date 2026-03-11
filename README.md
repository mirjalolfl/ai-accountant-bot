# 🤖 AI Buxgalter Bot

Telegram orqali ishlaydigan shaxsiy AI buxgalter. Claude AI yordamida qarzlar va xarajatlarni boshqaradi.

## ✨ Imkoniyatlar

- 💰 **Qarz boshqaruvi** — Olgan/bergan qarzlarni yozib borish
- 📝 **Xarajat kuzatish** — Kundalik xarajatlarni kategoriya bo'yicha saqlash
- ⏰ **Muddati eslatmasi** — O'tgan va yaqinlashgan qarzlar haqida ogohlantirish
- 📊 **Hisobotlar** — Moliyaviy holat tahlili
- 🧠 **Aqlli suhbat** — Oddiy tilda gapiring, bot tushunadi

## 🏗 Texnologiyalar

| Qatlam | Texnologiya |
|--------|------------|
| Bot | Telegram Bot API |
| Backend | Next.js API Routes |
| AI | Claude API (Anthropic) |
| DB | Firebase Firestore |
| Hosting | Vercel |
| Til | TypeScript |

## 📁 Tuzilma

```
├── pages/api/webhook.ts   ← Telegram webhook
├── lib/
│   ├── claude.ts          ← Claude AI + 10 ta tool
│   ├── firebase.ts        ← Firebase Admin SDK
│   └── userStore.ts       ← Firestore CRUD
├── types/index.ts         ← TypeScript turlari
├── scripts/setup-webhook.js
└── .env.example
```

## 🚀 O'rnatish

### 1. Telegram bot
[@BotFather](https://t.me/BotFather) → `/newbot` → tokenni saqlang

### 2. Firebase
Firebase Console → Firestore yarating → Service Account JSON yuklab oling

### 3. Vercel deploy
```bash
npm install
vercel
```

**Environment Variables** (Vercel dashboard):
```
TELEGRAM_BOT_TOKEN
TELEGRAM_WEBHOOK_SECRET
ANTHROPIC_API_KEY
FIREBASE_SERVICE_ACCOUNT_JSON
```

### 4. Webhook o'rnatish
```bash
node scripts/setup-webhook.js https://YOUR-APP.vercel.app
```

## 💬 Foydalanish

```
"Akadan 500,000 so'm qarz oldim"
"Sherzodga 1 mln berdim, oydan keyin qaytaradi"
"Qarzlarimni ko'rsat"
"Bugun taomga 85,000 sarfladim"
"Moliyaviy holatimni ko'rsat"
```

## Buyruqlar
`/start` `/summary` `/debts` `/expenses` `/help` `/clear`

---
Mirjalol Hasanov tomonidan yaratilgan 🇺🇿
