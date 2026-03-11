const { OpenAI } = require('openai');

async function test() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("GEMINI_API_KEY is missing");
    return;
  }

  const urls = [
    "https://generativelanguage.googleapis.com/v1beta/openai/",
    "https://generativelanguage.googleapis.com/v1beta/openai",
    // "https://generativelanguage.googleapis.com/v1/openai/",
  ];

  for (const url of urls) {
    console.log(`\nTesting: ${url}`);
    const client = new OpenAI({
      baseURL: url,
      apiKey: apiKey,
    });

    try {
      const resp = await client.chat.completions.create({
        model: "gemini-1.5-flash",
        messages: [{ role: "user", content: "ping" }],
      });
      console.log(`SUCCESS for ${url}:`, resp.choices[0].message.content);
    } catch (e) {
      console.error(`FAILED for ${url}:`, e.message);
      if (e.response) {
        console.error("Status:", e.response.status);
        console.error("Body:", await e.response.text());
      }
    }
  }
}

test();
