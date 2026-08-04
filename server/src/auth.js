import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { db } from './db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
if (!process.env.JWT_SECRET) {
  console.warn('[auth] 警告：JWT_SECRET 未设置，使用开发默认值（生产环境必须配置）');
}
const COOKIE_NAME = 'mms_token';
const TOKEN_TTL_SECONDS = 7 * 24 * 3600; // 7 天

export function signToken(user) {
  return jwt.sign({ uid: user.id, un: user.username }, JWT_SECRET, { expiresIn: TOKEN_TTL_SECONDS });
}

export function setAuthCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: TOKEN_TTL_SECONDS * 1000,
    path: '/',
  });
}

export function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME, { path: '/' });
}

export function publicUser(u) {
  return { id: u.id, username: u.username, nickname: u.nickname };
}

export function requireAuth(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return res.status(401).json({ error: '未登录' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = db.prepare('SELECT id, username, nickname FROM users WHERE id = ?').get(payload.uid);
    if (!user) return res.status(401).json({ error: '账号不存在' });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: '登录已过期，请重新登录' });
  }
}

export function createUser({ username, password, nickname }) {
  const hash = bcrypt.hashSync(password, 10);
  const now = new Date().toISOString();
  const info = db
    .prepare('INSERT INTO users (username, nickname, password_hash, created_at) VALUES (?, ?, ?, ?)')
    .run(username, nickname, hash, now);
  return db.prepare('SELECT id, username, nickname FROM users WHERE id = ?').get(info.lastInsertRowid);
}

export function findUserByUsername(username) {
  return db.prepare('SELECT * FROM users WHERE username = ?').get(username);
}

export function verifyPassword(user, password) {
  return bcrypt.compareSync(password, user.password_hash);
}