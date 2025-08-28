import type { NextApiRequest } from 'next';
import { decodeSession, SESSION_COOKIE_NAME } from './session';

export function getSessionFromReq(req: NextApiRequest) {
  const cookies = req.headers.cookie || '';
  const match = cookies.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`));
  const token = match?.[1] || null;
  return decodeSession(token);
}
