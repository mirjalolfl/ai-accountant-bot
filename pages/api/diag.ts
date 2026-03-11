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

  // 4. Gemini API Multi-test
  const variations = [
    { name: "documented", base: "https://generativelanguage.googleapis.com/v1beta/openai/", model: "gemini-1.5-flash" },
    { name: "no-slash", base: "https://generativelanguage.googleapis.com/v1beta/openai", model: "gemini-1.5-flash" },
    { name: "v1", base: "https://generativelanguage.googleapis.com/v1/openai/", model: "gemini-1.5-flash" },
    { name: "flash-latest", base: "https://generativelanguage.googleapis.com/v1beta/openai/", model: "gemini-1.5-flash-latest" },
  ];

  for (const v of variations) {
    try {
      const OpenAI = (await import("openai")).default;
      const client = new OpenAI({ 
        baseURL: v.base,
        apiKey: process.env.GEMINI_API_KEY! 
      });
      const resp = await client.chat.completions.create({
        model: v.model,
        max_tokens: 5,
        messages: [{ role: "user", content: "ping" }],
      });
      results[`gemini_${v.name}`] = "✅ OK: " + (resp.choices[0]?.message?.content || "ok");
    } catch (e) {
      results[`gemini_${v.name}`] = "❌ ERROR: " + String(e);
    }
  }

  // 5. List Available Models
  try {
    const fetch = (await import("node-fetch")).default || global.fetch;
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`;
    const resp = await fetch(url);
    const data = await resp.json();
    if (resp.ok) {
      results.available_models = (data.models || []).map((m: any) => m.name.replace("models/", "")).join(", ");
    } else {
      results.available_models = `❌ ERROR ${resp.status}: ` + JSON.stringify(data);
    }
  } catch (e) {
    results.available_models = "❌ ERROR: " + String(e);
  }

  // 6. Native Gemini Test (v1 check)
  try {
    const fetch = (await import("node-fetch")).default || global.fetch;
    const url = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: "ping" }] }] })
    });
    const data = await resp.json();
    results.gemini_native_v1 = resp.ok ? "✅ OK" : `❌ ERROR ${resp.status}`;
  } catch (e) {
    results.gemini_native_v1 = "❌ ERROR: " + String(e);
  }

  return res.status(200).json(results);
}
