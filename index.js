require('dotenv').config();
const { Telegraf } = require('telegraf');
const Anthropic = require('@anthropic-ai/sdk');
const admin = require('firebase-admin');

// Initialize Firebase Admin
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });
  } catch (error) {
    console.error('Firebase initialization error:', error);
  }
}

const db = admin.firestore();

// Initialize Anthropic
const anthropic = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY,
});

// Initialize Bot
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

const SYSTEM_PROMPT = `Siz Mirjalolning shaxsiy AI buxalterisiz. Ismingiz "Lavon AI Buxalter".
Sizning vazifalaringiz:
1. Foydalanuvchining qarzlarini, xarajatlarini va daromadlarini hisobga olish.
2. Moliyaviy maslahatlar berish.
3. Foydalanuvchi bilan do'stona va professional ohangda suhbatlashish.
4. Ma'lumotlarni saqlash va eslatib turish.

Sizga foydalanuvchining oldingi moliyaviy yozuvlari taqdim etiladi. Har doim aniq raqamlar bilan gapiring.`;

// Helper to get user data
async function getUserFinancials(userId) {
  try {
    const snapshot = await db.collection('users').doc(userId.toString()).collection('financials').orderBy('date', 'desc').limit(20).get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error getting financials:', error);
    return [];
  }
}

bot.start((ctx) => ctx.reply('Assalomu alaykum Mirjalol! Men sizning shaxsiy AI buxalteringizman. Qanday yordam bera olaman?'));

bot.on('text', async (ctx) => {
  const userId = ctx.from.id;
  const text = ctx.message.text;

  try {
    // Get history
    const history = await getUserFinancials(userId);
    const historyContext = JSON.stringify(history);

    // Call Claude
    const response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1024,
      system: SYSTEM_PROMPT + "\n\nFoydalanuvchi tarixi: " + historyContext,
      messages: [{ role: "user", content: text }],
    });

    const aiResponse = response.content[0].text;
    await ctx.reply(aiResponse);

    // Log interaction
    await db.collection('users').doc(userId.toString()).collection('logs').add({
      userText: text,
      aiResponse,
      date: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Bot error:', error);
    await ctx.reply('Xatolik yuz berdi. Iltimos keyinroq urinib ko\'ring.');
  }
});

// Vercel Serverless Function Handler
module.exports = async (req, res) => {
  if (req.method === 'POST') {
    try {
      await bot.handleUpdate(req.body);
      res.status(200).send('OK');
    } catch (err) {
      console.error(err);
      res.status(500).send('Error');
    }
  } else {
    res.status(200).send('Bot is running');
  }
};

// For local development
if (process.env.NODE_ENV !== 'production') {
  bot.launch().then(() => console.log('Bot started locally'));
}
