// pages/api/setup.ts
// Webhook muvaffaqiyatli o'rnatildi — bu endpoint o'chirilgan
import type { NextApiRequest, NextApiResponse } from "next";
export default function handler(_req: NextApiRequest, res: NextApiResponse) {
  return res.status(404).json({ error: "Not found" });
}
