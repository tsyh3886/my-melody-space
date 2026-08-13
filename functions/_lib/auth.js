import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

export const COOKIE_NAME = 'mms_token';
const TOKEN_TTL_SECONDS = 7 * 24 * 3600; // 7 天

function secret(env) {
  return env.JWT_SECRET || 'dev-secret-change-me';
}

export function signToken(env, user) {
  return jwt.sign({ uid: user.id, un: user.username }, secret(env), { expiresIn: TOKEN_TTL_SECONDS });
}

export function verifyToken(env, token) {
  return jwt.verify(token, secret(env));
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
