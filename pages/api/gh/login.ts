import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";

const CLIENT_ID = process.env.GITHUB_CLIENT_ID!;
const APP_URL = process.env.APP_URL!; // e.g. http://localhost:4123

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const next = (req.query.next as string) || "/saml/sydney"; // where to go after login
  const state = crypto.randomBytes(16).toString("hex");

  // Store state in a short-lived cookie to validate CSRF
  res.setHeader("Set-Cookie", [
    `gh_oauth_state=${state}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600${process.env.NODE_ENV === "production" ? "; Secure" : ""}`,
    // persist intended next URL too (optional)
    `gh_oauth_next=${encodeURIComponent(next)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600${process.env.NODE_ENV === "production" ? "; Secure" : ""}`,
  ]);

  const redirect_uri = `${APP_URL}/api/gh/callback`;
  const scope = "read:user read:org";

  const url =
    `https://github.com/login/oauth/authorize` +
    `?client_id=${encodeURIComponent(CLIENT_ID)}` +
    `&redirect_uri=${encodeURIComponent(redirect_uri)}` +
    `&scope=${encodeURIComponent(scope)}` +
    `&state=${encodeURIComponent(state)}`;

  res.redirect(302, url);
}
