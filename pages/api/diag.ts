// pages/api/diag.ts — vaqtinchalik diagnostika
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  const results: Record<string, string> = {};

  // 1. Env variables
  results.TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ? "✅ bor" : "❌ YO'Q";
  results.GEMINI_API_KEY = process.env.GEMINI_API_KEY ? "✅ bor" : "❌ YO'Q";
  results.FIREBASE_SERVICE_ACCOUNT_JSON = process.env.FIREBASE_SERVICE_ACCOUNT_JSON ? "✅ bor" : "❌ YO'Q";

  // 2. Firebase JSON parse
  try {
    const parsed = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || "");
    results.firebase_json_parse = "✅ JSON to'g'ri";
    results.firebase_project_id = parsed.project_id || "❌ topilmadi";
  } catch (e) {
    results.firebase_json_parse = "❌ JSON PARSE XATOSI: " + String(e);
  }

  // 3. Firebase Firestore
  try {
    const admin = await import("firebase-admin");
    if (!admin.apps.length) {
      const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || "{}");
      admin.initializeApp({ credential: admin.credential.cert(sa) });
    }
    const db = admin.firestore();
    await db.collection("_diag").doc("test").set({ ts: Date.now() });
    results.firebase_firestore = "✅ Firestore ishladi";
  } catch (e) {
    results.firebase_firestore = "❌ FIREBASE: " + String(e);
  }

  // 4. Gemini API
  try {
    const OpenAI = (await import("openai")).default;
    const client = new OpenAI({ 
      baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
      apiKey: process.env.GEMINI_API_KEY! 
    });
    const resp = await client.chat.completions.create({
      model: "gemini-2.5-flash",
      max_tokens: 5,
      messages: [{ role: "user", content: "ping" }],
    });
    results.gemini_api = "✅ Gemini ishladi: " + (resp.choices[0]?.message?.content || "ok");
  } catch (e) {
    results.gemini_api = "❌ GEMINI: " + String(e);
  }

  return res.status(200).json(results);
}
