import crypto from 'crypto';

const COOKIE_NAME = 'gh_sess';
const ALGO = 'sha256';

const isProd = process.env.NODE_ENV === 'production';
const SESSION_SECRET = process.env.SESSION_SECRET!;
if (!SESSION_SECRET) throw new Error('Missing SESSION_SECRET');

type SessionPayload = {
  sub: number; // GitHub user id
  login: string; // GitHub username
  exp: number; // epoch seconds
};

function b64url(buf: Buffer | string) {
  return Buffer.from(buf).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function sign(data: string) {
  return b64url(crypto.createHmac(ALGO, SESSION_SECRET).update(data).digest());
}

export function encodeSession(payload: Omit<SessionPayload, 'exp'>, ttlSeconds = 60 * 60 * 8) {
  const body = { ...payload, exp: Math.floor(Date.now() / 1000) + ttlSeconds };
  const json = JSON.stringify(body);
  const sig = sign(json);
  return `${b64url(json)}.${sig}`;
}

export function decodeSession(token?: string | null): SessionPayload | null {
  if (!token) return null;
  const [b64, sig] = token.split('.');
  if (!b64 || !sig) return null;
  const json = Buffer.from(b64.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
  const good = sign(json) === sig;
  if (!good) return null;
  const payload = JSON.parse(json) as SessionPayload;
  if (payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

export function makeSessionCookie(token: string, maxAgeSec = 60 * 60 * 8) {
  // HttpOnly cookie
  const attrs = [
    `${COOKIE_NAME}=${token}`,
    `Path=/`,
    `HttpOnly`,
    `SameSite=Lax`,
    `Max-Age=${maxAgeSec}`,
    isProd ? `Secure` : ``,
  ].filter(Boolean);
  return attrs.join('; ');
}

export function clearSessionCookie() {
  const attrs = [
    `${COOKIE_NAME}=;`,
    `Path=/`,
    `HttpOnly`,
    `SameSite=Lax`,
    `Max-Age=0`,
    isProd ? `Secure` : ``,
  ].filter(Boolean);
  return attrs.join('; ');
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;
