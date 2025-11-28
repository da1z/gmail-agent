import { verifySignature } from "@upstash/qstash/nextjs";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { gmail_v1, google } from "googleapis";
import { simpleParser } from "mailparser";
import { getAuthClient } from "../lib/get-auth-client.js";
import { isLocal } from "../lib/is-local.js";
import {
  LAST_PROCESSED_TIMESTAMP_KV,
  PROCESSED_EMAILS_KV,
  REFRESH_TOKEN_KV,
} from "../lib/kv.js";
import { getAILabel } from "../lib/get-ai-label.js";

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

const getSystemLabels = async (gmail: gmail_v1.Gmail) => {
  const allLabels = await gmail.users.labels.list({
    userId: "me",
  });
  return new Set(
    allLabels.data.labels
      ?.filter((label) => label.type === "system")
      ?.map((label) => label.id) ?? []
  );
};

const processMessage = async ({
  message,
  gmail,
}: {
  message: gmail_v1.Schema$Message;
  gmail: gmail_v1.Gmail;
}) => {
  if (!message.threadId || !message.id) return;

  const isNew = await PROCESSED_EMAILS_KV.set(message.id);
  if (!isNew) {
    console.log(
      `Skipping email ${message.id} as it has already been processed`
    );
    return;
  }

  const threadMetaRes = await gmail.users.threads.get({
    userId: "me",
    id: message.threadId,
    format: "metadata",
  });

  // TODO: For now only process single message threads
  if ((threadMetaRes.data.messages?.length ?? 0) > 1) {
    console.log(
      `Skipping email ${message.id} as it is part of a thread with multiple messages`
    );
    return;
  }

  const messageRes = await gmail.users.messages.get({
    userId: "me",
    id: message.id,
    format: "raw",
  });
  const rawString = Buffer.from(messageRes.data.raw!, "base64url").toString(
    "utf-8"
  );

  const email = await simpleParser(rawString);

  const systemLabels = await getSystemLabels(gmail);

  // Skip if message has a non-system label
  if (messageRes.data.labelIds?.some((labelId) => !systemLabels.has(labelId))) {
    console.log(
      `Skipping email ${message.id} as it has a non-system label`,
      email.subject
    );
    return;
  }

  const label = await getAILabel(email);
  if (isLocal()) {
    console.log(
      `Running in local mode. Would have processed email: ${email.subject} with label: ${label}`
    );
  } else {
    const labelId = await getOrCreateLabel(gmail, label);

    await gmail.users.messages.modify({
      userId: "me",
      id: message.id,
      requestBody: { addLabelIds: [labelId] },
    });
  }

  return { isProcessed: true, label };
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
  const defaultTimestamp = now - 60 * 60 * 48;
  const lastTimestamp =
    (await LAST_PROCESSED_TIMESTAMP_KV.get()) ?? defaultTimestamp;

  try {
    const listRes = await gmail.users.messages.list({
      userId: "me",
      q: `after:${lastTimestamp}`,
      maxResults: 10,
    });

    const messages = listRes.data.messages ?? [];

    if (messages.length === 0) {
      await LAST_PROCESSED_TIMESTAMP_KV.set(now);
      return res.status(200).json({ message: "No new emails" });
    }

    const processed = [];

    for (const message of messages) {
      const result = await processMessage({ message, gmail });
      if (result?.isProcessed) {
        processed.push({ id: message.id, label: result.label });
      }
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
