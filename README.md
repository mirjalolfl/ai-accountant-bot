# AI Accountant Telegram Bot

Bu Mirjalol uchun maxsus yaratilgan aqlli shaxsiy AI buxalter Telegram boti.

## Texnologiyalar
- **AI Miyyasi**: Claude 3.5 Sonnet (Anthropic API)
- **Telegram Framework**: Telegraf.js
- **Ma'lumotlar bazasi**: Firebase Firestore
- **Deploy**: Vercel (Serverless Functions)

## Sozlash (Environment Variables)
Vercel'da quyidagi o'zgaruvchilarni qo'shing:
- `CLAUDE_API_KEY`: Anthropic API kaliti
- `TELEGRAM_BOT_TOKEN`: Telegram Bot tokeni
- `FIREBASE_PROJECT_ID`: Firebase loyiha ID
- `FIREBASE_CLIENT_EMAIL`: Firebase service account email
- `FIREBASE_PRIVATE_KEY`: Firebase service account private key

## Webhook o'rnatish
Deploy qilganingizdan so'ng, quyidagi URL'ga brauzer orqali kiring:
`https://api.telegram.org/bot<TOKEN>/setWebhook?url=<VERCEL_URL>`
