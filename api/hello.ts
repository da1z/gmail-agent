import type { VercelRequest, VercelResponse } from "@vercel/node";
import { google } from "googleapis";
import { getAuthClient } from "../lib/get-auth-client";
import { REFRESH_TOKEN_KV } from "../lib/kv";
import { simpleParser, ParsedMail } from "mailparser";

export default async function handler(
  _req: VercelRequest,
  res: VercelResponse
) {
  const refreshToken = await REFRESH_TOKEN_KV.get();

  if (!refreshToken) {
    console.error("No refresh token found in Redis");
    return res
      .status(401)
      .json({ error: "No refresh token. Visit /api/auth to login." });
  }

  const authClient = getAuthClient();
  authClient.setCredentials({ refresh_token: refreshToken });
  const gmail = google.gmail({ version: "v1", auth: authClient });

  const threadRes = await gmail.users.threads.get({
    userId: "me",
    id: "19ac39eb7dfbd95b",
    format: "full",
  });

  const messRes = await gmail.users.messages.get({
    userId: "me",
    id: "19ac3a44b34d4c56",
    format: "raw",
  });
  const parsed = await simpleParser(
    Buffer.from(messRes.data.raw!, "base64url")
  );
  return res.status(200).json(parsed);
  const messages = await Promise.all(
    threadRes.data.messages?.map(async (message) => {
      const msgRes = await gmail.users.messages.get({
        userId: "me",
        id: message.id!,
        format: "full", // ← Returns RFC 2822 format
      });
      return msgRes.data;
    }) ?? []
  );
  return res.status(200).json(messages);
}
