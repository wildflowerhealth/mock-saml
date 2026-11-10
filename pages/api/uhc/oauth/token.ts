import type { NextApiRequest, NextApiResponse } from 'next';

/**
 * The mock UHC eligibility API's token endpoint (SYS-20903): UHC's client-credentials grant,
 * which portal-facade's UhcClient asks before each eligibility call. Any client gets a token;
 * nothing here is a secret.
 */
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).send(`Method ${req.method} Not Allowed`);
  }
  res.status(200).json({ access_token: 'mock-uhc-access-token', token_type: 'Bearer', expires_in: 3600 });
}
