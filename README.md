# Gmail Auto-Labeler

An AI-powered Gmail email auto-labeler that automatically classifies incoming emails using Claude Haiku and applies appropriate labels.

## Features

- **Automatic email classification** into 6 categories:

  - `ACTION_REQUIRED` — requires a response, decision, approval, or task completion
  - `FYI` — informational, no action needed
  - `TRANSACTIONAL` — automated system emails (receipts, alerts, notifications, CI/CD, GitHub)
  - `NEWSLETTER` — subscribed content, digests, marketing
  - `SPAM_LOW_PRIORITY` — unsolicited outreach, cold sales, junk
  - `UNCATEGORIZED` — does not clearly fit any label above

- **Smart filtering**:

  - Skips messages that already have user labels (only processes unlabeled emails)
  - Only processes single-message threads (skips conversations with multiple replies)
  - Creates labels automatically if they don't exist

- **Duplicate prevention** — tracks processed emails in Redis to avoid reprocessing

## Tech Stack

- **[Vercel Functions](https://vercel.com/docs/functions)** — Serverless API endpoints
- **[Upstash Redis](https://upstash.com/docs/redis/overall/getstarted)** — Token storage and processed emails tracking
- **[Upstash QStash](https://upstash.com/docs/qstash/overall/getstarted)** — Scheduled webhook invocation
- **[Google OAuth 2.0](https://developers.google.com/identity/protocols/oauth2)** — Gmail API authentication
- **[Anthropic Claude Haiku](https://www.anthropic.com/claude)** — Email classification via AI SDK Gateway

## Prerequisites

- Google Cloud project with Gmail API enabled
- Vercel account

## Setup

### 1. Vercel Account

1. Create a [Vercel account](https://vercel.com/) and link the project
2. Add [Upstash Redis integration](https://vercel.com/integrations/upstash) to your project

### 2. Local Development

Pull environment variables from Vercel:

```bash
vercel env pull
```

### 3. Deploy

```bash
vercel deploy
```

### 4. Authenticate

Visit `https://your-app.vercel.app/api/auth` to initiate the Google OAuth flow and grant Gmail access.

## API Endpoints

| Endpoint        | Method | Description                                   |
| --------------- | ------ | --------------------------------------------- |
| `/api/auth`     | GET    | Initiates Google OAuth flow                   |
| `/api/callback` | GET    | OAuth callback, stores refresh token in Redis |
| `/api/webhook`  | POST   | Main processing endpoint (invoked by QStash)  |

## How It Works

1. QStash triggers the `/api/webhook` endpoint on a schedule
2. The webhook fetches recent emails from Gmail
3. For each email:
   - Checks if already processed (stored in Redis)
   - Skips if the thread has multiple messages
   - Skips if the message already has a user-applied label
   - Sends email content to Claude Haiku for classification
   - Creates the label if it doesn't exist
   - Applies the classified label to the email
4. Updates the last processed timestamp

## License

MIT
