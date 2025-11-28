import { google } from "googleapis";
import { isLocal } from "./is-local.js";

export const getAuthClient = () => {
  const redirectUri = isLocal()
    ? "http://localhost:3000/api/callback"
    : process.env.REDIRECT_URI;

  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri
  );
};
