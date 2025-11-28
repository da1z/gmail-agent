import { ExactMatch } from "autoevals";
import { evalite } from "evalite";
import type { ParsedMail } from "mailparser";
import { getAILabel } from "../get-ai-label.js";

const createMockEmail = (
  from: string,
  subject: string,
  text: string
): ParsedMail =>
  ({
    from: { text: from },
    subject,
    text,
  } as ParsedMail);

evalite("getAILabel", {
  data: [
    {
      input: createMockEmail(
        "boss@company.com",
        "Urgent: Need your approval on the budget proposal",
        "Hi, please review and approve the attached budget proposal by end of day. Let me know if you have any questions."
      ),
      expected: "ACTION_REQUIRED",
    },
    {
      input: createMockEmail(
        "team@company.com",
        "Project status update - Q4 planning complete",
        "Hi team, just wanted to let you know that the Q4 planning session has been completed. All deliverables have been documented in Confluence. No action needed on your part."
      ),
      expected: "FYI",
    },
    {
      input: createMockEmail(
        "noreply@github.com",
        "[user/repo] Pull request #123 merged",
        "Merged #123 into main. Commit abc123: Fix typo in README.md"
      ),
      expected: "TRANSACTIONAL",
    },
    {
      input: createMockEmail(
        "newsletter@techweekly.com",
        "Tech Weekly Digest - Top Stories This Week",
        "Welcome to this week's Tech Weekly! Here are the top stories: 1. AI advances in 2024, 2. New JavaScript framework released, 3. Cloud computing trends. Click to read more. Unsubscribe at any time."
      ),
      expected: "NEWSLETTER",
    },
    {
      input: createMockEmail(
        "sales@randomcompany.io",
        "Quick question about your business needs",
        "Hi, I noticed your company is growing and wanted to reach out about our enterprise solutions. We've helped 500+ companies increase revenue by 200%. Can I get 15 minutes on your calendar?"
      ),
      expected: "SPAM_LOW_PRIORITY",
    },
    {
      input: createMockEmail(
        "promo@onlinestore.com",
        "🔥 FLASH SALE: 50% OFF Everything Today Only!",
        "Don't miss out on our biggest sale of the year! Use code SAVE50 at checkout. Shop now before it's too late! This email was sent to you because you made a purchase. To unsubscribe, click here."
      ),
      expected: "SPAM_LOW_PRIORITY",
    },
    {
      input: createMockEmail(
        "unknown@example.org",
        "Fwd: Fwd: Fwd:",
        "---------- Forwarded message ----------"
      ),
      expected: "UNCATEGORIZED",
    },
    {
      input: createMockEmail(
        "hello@blueprint.com",
        "Our sale started today",
        "Hi friend,\n\nOur sale started today. For the next three days, these products are all 25% off. It's our biggest discount of the year and ends Monday at midnight.\n\nYuzu Pineapple Longevity Mix.v NAC, Ginger + Curcumin. Nutty Butter. Cocoa. Matcha. Manuka Honey. Nutty Butter. Macadamia Nut Puree.\n\nWe'll be saying goodbye to all of these products over the next several months, so if you have any favorites, now's the time to stock up.\n\nUse code IMMORTAL25 at checkout.\n\nBlueprint"
      ),
      expected: "SPAM_LOW_PRIORITY",
    },
  ],
  task: async (input) => {
    return getAILabel(input);
  },
  scorers: [ExactMatch],
  columns: async ({ input, output }) => {
    return [
      {
        label: "Input",
        value: (
          input.from?.text +
          " " +
          input.subject +
          " " +
          input.text
        ).slice(0, 50),
      },
      { label: "Output", value: output },
    ];
  },
});
