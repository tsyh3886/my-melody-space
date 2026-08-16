import bcrypt from 'bcryptjs';

export const COOKIE_NAME = 'mms_token';
const TOKEN_TTL_SECONDS = 7 * 24 * 3600; // 7 天

const enc = new TextEncoder();
const dec = new TextDecoder();

function b64url(bytes) {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(s) {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4);
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function hmacKey(env) {
  const secret = env.JWT_SECRET || 'dev-secret-change-me';
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

export async function signToken(env, user) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(enc.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const payload = b64url(enc.encode(JSON.stringify({ uid: user.id, un: user.username, iat: now, exp: now + TOKEN_TTL_SECONDS })));
  const data = `${header}.${payload}`;
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(env), enc.encode(data));
  return `${data}.${b64url(new Uint8Array(sig))}`;
}

export async function verifyToken(env, token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) throw new Error('invalid token');
  const [header, payload, sig] = parts;
  const valid = await crypto.subtle.verify('HMAC', await hmacKey(env), b64urlDecode(sig), enc.encode(`${header}.${payload}`));
  if (!valid) throw new Error('invalid token');
  const claim = JSON.parse(dec.decode(b64urlDecode(payload)));
  if (!claim.exp || claim.exp < Math.floor(Date.now() / 1000)) throw new Error('token expired');
  return { uid: claim.uid, un: claim.un };
}

export function parseCookies(request) {
  const header = request.headers.get('cookie') || '';
  const out = {};
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0) {
      const name = part.slice(0, i).trim();
      let value = part.slice(i + 1).trim();
      try { value = decodeURIComponent(value); } catch { /* 保留原值 */ }
      out[name] = value;
    }
  }
  return out;
}

export function getToken(request) {
  return parseCookies(request)[COOKIE_NAME];
}

export function authCookie(token) {
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${TOKEN_TTL_SECONDS}; Secure`;
}

export function clearAuthCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Secure`;
}

export function publicUser(u) {
  return { id: u.id, username: u.username, nickname: u.nickname };
}

export async function createUser(env, { username, password, nickname }) {
  const hash = await bcrypt.hash(password, 10);
  const now = new Date().toISOString();
  const info = await env.DB.prepare(
    'INSERT INTO users (username, nickname, password_hash, created_at) VALUES (?, ?, ?, ?)'
  ).bind(username, nickname, hash, now).run();
  return env.DB.prepare('SELECT id, username, nickname FROM users WHERE id = ?')
    .bind(info.meta.last_row_id).first();
}

export async function findUserByUsername(env, username) {
  return env.DB.prepare('SELECT * FROM users WHERE username = ?').bind(username).first();
}

export async function verifyPassword(user, password) {
  return bcrypt.compare(password, user.password_hash);
}
