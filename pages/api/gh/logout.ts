import type { NextApiRequest, NextApiResponse } from "next";
import { clearSessionCookie } from "../../../lib/session";

export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Set-Cookie", clearSessionCookie());
  res.redirect(302, "/saml/sydney");
}
