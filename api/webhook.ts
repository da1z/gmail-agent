import { verifySignature } from "@upstash/qstash/nextjs";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { google, gmail_v1 } from "googleapis";
import { ParsedMail, simpleParser } from "mailparser";
import { getAuthClient } from "../lib/get-auth-client";
import { isLocal } from "../lib/is-local";
import {
  LAST_PROCESSED_TIMESTAMP_KV,
  PROCESSED_EMAILS_KV,
  REFRESH_TOKEN_KV,
} from "../lib/kv";
import { gateway, generateObject } from "ai";
import { z } from "zod";

const defaultLabels = [
  {
    label: "ACTION_REQUIRED",
    reason: "requires a response, decision, approval, or task completion",
  },
  {
    label: "FYI",
    reason: "informational, no action needed",
  },
  {
    label: "TRANSACTIONAL",
    reason:
      "automated system emails (receipts, alerts, notifications, CI/CD, GitHub)",
  },
  {
    label: "NEWSLETTER",
    reason: "subscribed content, digests, marketing",
  },
  {
    label: "SPAM_LOW_PRIORITY",
    reason: "unsolicited outreach, cold sales, junk",
  },
  {
    label: "UNCATEGORIZED",
    reason: "does not clearly fit any label above",
  },
];

const getOrCreateLabel = async (
  gmail: gmail_v1.Gmail,
  labelName: string
): Promise<string> => {
  // List existing labels
  const labelsRes = await gmail.users.labels.list({ userId: "me" });
  const existingLabel = labelsRes.data.labels?.find(
    (l) => l.name === labelName
  );

  if (existingLabel?.id) {
    return existingLabel.id;
  }

  // Create new label
  const createRes = await gmail.users.labels.create({
    userId: "me",
    requestBody: {
      name: labelName,
      labelListVisibility: "labelShow",
      messageListVisibility: "show",
    },
  });

  return createRes.data.id!;
};

const getAILabel = async (email: ParsedMail) => {
  const { object } = await generateObject({
    model: gateway("anthropic/claude-haiku-4.5"),
    prompt: `# Email Classification Prompt

Classify the email into exactly ONE label:

${defaultLabels
  .map((label) => `- **${label.label}** — ${label.reason}`)
  .join("\n")}

  The email is:

  From: ${email.from?.text ?? "Unknown"}
  Subject: ${email.subject}
  Body: ${email.text}
`,
    schema: z.object({
      label: z.enum(defaultLabels.map((label) => label.label)),
      reasoning: z.string(),
    }),
  });

  return object.label;
};

const processMessage = async (
  message: gmail_v1.Schema$Message,
  gmail: gmail_v1.Gmail
) => {
  const raw = Buffer.from(message.raw!, "base64url").toString("utf-8");
  const parsed = await simpleParser(raw);

  const label = await getAILabel(parsed);
  const labelId = await getOrCreateLabel(gmail, label);

  await gmail.users.messages.modify({
    userId: "me",
    id: message.id!,
    requestBody: {
      addLabelIds: [labelId],
    },
  });

  return parsed;
};

async function handler(_req: VercelRequest, res: VercelResponse) {
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

  const now = Math.floor(Date.now() / 1000);
  const defaultTimestamp = now - 60 * 60 * 24; // 1 hour ago
  const lastTimestamp =
    (await LAST_PROCESSED_TIMESTAMP_KV.get()) ?? defaultTimestamp;

  try {
    const listRes = await gmail.users.messages.list({
      userId: "me",
      q: `after:${lastTimestamp}`,
      maxResults: 1,
    });

    const messages = listRes.data.messages ?? [];

    if (messages.length === 0) {
      await LAST_PROCESSED_TIMESTAMP_KV.set(now);
      return res.status(200).json({ message: "No new emails" });
    }

    const processed = [];

    for (const message of messages) {
      if (!message.threadId || !message.id) continue;

      const isNew = await PROCESSED_EMAILS_KV.set(message.id);

      if (!isNew) {
        console.log(`Skipping already processed email: ${message.id}`);
        continue;
      }

      const threadMetaRes = await gmail.users.threads.get({
        userId: "me",
        id: message.threadId,
        format: "metadata",
      });

      if ((threadMetaRes.data.messages?.length ?? 0) > 1) {
        // TODO: Handle threads with multiple messages
        console.log(
          `Skipping thread with multiple messages: ${message.threadId}`
        );
        continue;
      }

      const messageRes = await gmail.users.messages.get({
        userId: "me",
        id: message.id,
        format: "raw",
      });

      await processMessage(messageRes.data, gmail);

      processed.push({ id: message.id });
    }

    await LAST_PROCESSED_TIMESTAMP_KV.set(now);

    return res
      .status(200)
      .json({ success: true, processedCount: processed.length });
  } catch (error: any) {
    console.error("Error processing emails:", error);
    if (error.response?.status === 401 || error.code === 401) {
      return res
        .status(401)
        .json({ error: "Authentication failed. Token might be expired." });
    }
    return res
      .status(500)
      .json({ error: "Internal Server Error", details: error.message });
  }
}

export default isLocal() ? handler : verifySignature(handler);
