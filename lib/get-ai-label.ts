import { generateObject } from "ai";
import { ParsedMail } from "mailparser";
import { z } from "zod";
import { getModel } from "./get-model.js";

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

export const getAILabel = async (email: ParsedMail) => {
  const { object } = await generateObject({
    model: await getModel("anthropic/claude-haiku-4.5"),
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
