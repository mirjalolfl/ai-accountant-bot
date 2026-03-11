// pages/api/diag.ts — vaqtinchalik diagnostika. Xato topilgandan keyin o'chiriladi.
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  const results: Record<string, string> = {};

  // 1. Env variables mavjudligi
  results.TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ? "✅ bor" : "❌ YO'Q";
  results.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ? "✅ bor" : "❌ YO'Q";
  results.FIREBASE_SERVICE_ACCOUNT_JSON = process.env.FIREBASE_SERVICE_ACCOUNT_JSON ? "✅ bor" : "❌ YO'Q";

  // 2. Firebase JSON parse
  try {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON || "";
    const parsed = JSON.parse(raw);
    results.firebase_json_parse = "✅ JSON to'g'ri";
    results.firebase_project_id = parsed.project_id || "❌ project_id topilmadi";
    results.firebase_type = parsed.type || "❌ type topilmadi";
  } catch (e) {
    results.firebase_json_parse = "❌ JSON PARSE XATOSI: " + String(e);
  }

  // 3. Firebase Admin init
  try {
    const admin = await import("firebase-admin");
    if (!admin.apps.length) {
      const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || "{}");
      admin.initializeApp({ credential: admin.credential.cert(sa) });
    }
    const db = admin.firestore();
    // Test write/read
    await db.collection("_diag").doc("test").set({ ts: Date.now() });
    results.firebase_firestore = "✅ Firestore ulanish ishladi";
  } catch (e) {
    results.firebase_firestore = "❌ FIREBASE XATOSI: " + String(e);
  }

  // 4. Anthropic API
  try {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
    const resp = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 10,
      messages: [{ role: "user", content: "ping" }],
    });
    results.anthropic_api = "✅ Claude API ishladi: " + resp.content[0]?.type;
  } catch (e) {
    results.anthropic_api = "❌ CLAUDE XATOSI: " + String(e);
  }

  return res.status(200).json(results);
}
