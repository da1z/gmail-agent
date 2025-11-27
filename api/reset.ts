import type { VercelRequest, VercelResponse } from "@vercel/node";
import { LAST_PROCESSED_TIMESTAMP_KV, PROCESSED_EMAILS_KV } from "../lib/kv";

export default async (_req: VercelRequest, res: VercelResponse) => {
  await LAST_PROCESSED_TIMESTAMP_KV.delete();
  const deletedCount = await PROCESSED_EMAILS_KV.deleteAll();
  return res.status(200).json({
    success: true,
    message: "Last processed timestamp and dedup keys reset",
    deletedDedupKeys: deletedCount,
  });
};
