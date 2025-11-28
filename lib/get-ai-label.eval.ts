import { evalite } from "evalite";
import { ExactMatch } from "autoevals";
import { getAILabel } from "../api/webhook";
import type { ParsedMail } from "mailparser";

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
        "friend@personal.com",
        "Hey",
        "Just thinking about you. Hope everything is going well!"
      ),
      expected: "UNCATEGORIZED",
    },
  ],
  task: async (input) => {
    return getAILabel(input);
  },
  scorers: [ExactMatch],
});
