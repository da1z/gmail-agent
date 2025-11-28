import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAuthClient } from "../lib/get-auth-client.js";
import { REFRESH_TOKEN_KV } from "../lib/kv.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { code, error } = req.query;

  if (error) {
    return res.status(400).json({ error: `OAuth error: ${error}` });
  }

  if (!code || typeof code !== "string") {
    return res.status(400).json({ error: "Missing authorization code" });
  }

  try {
    const { tokens } = await getAuthClient().getToken(code);

    await REFRESH_TOKEN_KV.set(tokens.refresh_token!);

    return res.status(200).send(`
      <html>
        <body style="font-family: sans-serif; padding: 40px;">
          <h1>OAuth Success!</h1>
          <p>Refresh token stored in Redis.</p>
          <p>Key: <code>gmail-agent:refresh_token</code></p>
        </body>
      </html>
    `);
  } catch (err) {
    console.error("OAuth token exchange error:", err);
    return res
      .status(500)
      .json({ error: "Failed to exchange code for tokens" });
  }
}
