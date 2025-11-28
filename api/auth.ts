import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAuthClient } from "../lib/get-auth-client.js";

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.modify",
];

export default function handler(_req: VercelRequest, res: VercelResponse) {
  const authUrl = getAuthClient().generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent", // Force to get refresh_token
  });

  return res.redirect(authUrl);
}
