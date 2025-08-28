import type { NextApiRequest, NextApiResponse } from 'next';
import { getSessionFromReq } from '../../lib/session-api';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const sess = getSessionFromReq(req);
  res.json({ session: sess });
}
