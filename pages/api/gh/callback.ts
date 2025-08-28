import type { NextApiRequest, NextApiResponse } from "next";
import { encodeSession, makeSessionCookie, clearSessionCookie } from "../../../lib/session";

const CLIENT_ID = process.env.GITHUB_CLIENT_ID!;
const CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET!;
const APP_URL = process.env.APP_URL!;

const REQUIRED_ORG = 'wildflowerhealth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { code, state } = req.query;

  const cookies = parseCookies(req.headers.cookie || "");
  if (!state || cookies["gh_oauth_state"] !== state) {
    res.setHeader("Set-Cookie", ["gh_oauth_state=; Path=/; Max-Age=0", "gh_oauth_next=; Path=/; Max-Age=0"]);
    return res.status(400).send("Invalid OAuth state");
  }

  // Exchange code for token
  const tokenResp = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code,
      redirect_uri: `${APP_URL}/api/gh/callback`,
    }),
  });
  const tokenJson = await tokenResp.json();
  const access_token = tokenJson.access_token as string | undefined;
  if (!access_token) {
    return res.status(401).send("OAuth token exchange failed");
  }

  // Check org membership (must be active)
  const memResp = await fetch(`https://api.github.com/user/memberships/orgs/${REQUIRED_ORG}`, {
    headers: {
      Authorization: `Bearer ${access_token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "wfh-mock-sydney",
    },
  });

  if (!memResp.ok) {
    return res.status(403).send("Not a member of required org");
  }
  const membership = await memResp.json();
  if (membership?.state !== "active") {
    return res.status(403).send("Org membership not active");
  }

  const userResp = await fetch("https://api.github.com/user", {
    headers: { Authorization: `Bearer ${access_token}`, Accept: "application/vnd.github+json" },
  });
  const user = await userResp.json();

  // Create a signed session cookie (no token stored client-side)
  const token = encodeSession({ sub: user.id, login: user.login }, 60 * 60 * 8);
  res.setHeader("Set-Cookie", [
    makeSessionCookie(token),
    // clear the temporary oauth cookies
    "gh_oauth_state=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0",
    "gh_oauth_next=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0",
  ]);

  const next = decodeURIComponent(cookies["gh_oauth_next"] || "/");
  res.redirect(302, next);
}

function parseCookies(header: string): Record<string, string> {
  const out: Record<string, string> = {};
  header.split(/; */).forEach((part) => {
    const idx = part.indexOf("=");
    if (idx < 0) return;
    const k = part.slice(0, idx).trim();
    const v = decodeURIComponent(part.slice(idx + 1).trim());
    out[k] = v;
  });
  return out;
}
