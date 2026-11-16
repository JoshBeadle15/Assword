const crypto = require('crypto');

const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const COOKIE_NAME = 'mv_auth';

function getSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error('SESSION_SECRET environment variable is not set');
  }
  return secret;
}

function sign(value) {
  const sig = crypto.createHmac('sha256', getSecret()).update(value).digest('hex');
  return `${value}.${sig}`;
}

function verify(token) {
  if (!token || typeof token !== 'string') return false;
  const dot = token.lastIndexOf('.');
  if (dot === -1) return false;
  const value = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = crypto.createHmac('sha256', getSecret()).update(value).digest('hex');
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expected);
  if (sigBuf.length !== expectedBuf.length) return false;
  if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return false;

  const [prefix, expiryStr] = value.split(':');
  if (prefix !== 'ok') return false;
  const expiry = Number(expiryStr);
  if (!Number.isFinite(expiry) || Date.now() > expiry) return false;
  return true;
}

function issueCookie(res) {
  const expiry = Date.now() + TTL_MS;
  const token = sign(`ok:${expiry}`);
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: TTL_MS,
  });
}

function clearCookie(res) {
  res.clearCookie(COOKIE_NAME);
}

function requireAuth(req, res, next) {
  if (verify(req.cookies[COOKIE_NAME])) return next();
  return res.status(401).json({ error: 'Not authenticated' });
}

module.exports = { issueCookie, clearCookie, requireAuth, COOKIE_NAME };
