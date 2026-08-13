// /api/* 中间件：初始化表结构 + JWT 认证
import { jsonError } from '../_lib/helpers.js';
import { getToken, verifyToken } from '../_lib/auth.js';

// 无需登录即可访问的路径
const PUBLIC_PATHS = new Set([
  '/api/health',
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/logout',
]);

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  nickname TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS goals (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  deadline TEXT,
  progress INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT '其他',
  due_date TEXT,
  priority TEXT NOT NULL DEFAULT '中',
  status TEXT NOT NULL DEFAULT '待完成',
  goal_id TEXT REFERENCES goals(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT DEFAULT '',
  tags TEXT DEFAULT '',
  category TEXT NOT NULL DEFAULT '其他',
  created_at TEXT NOT NULL
);
`;

let schemaReady = false;

export async function onRequest(context) {
  const { request, env, data } = context;
  const url = new URL(request.url);

  if (!schemaReady) {
    await env.DB.exec(SCHEMA);
    schemaReady = true;
  }

  if (PUBLIC_PATHS.has(url.pathname)) {
    return context.next();
  }

  const token = getToken(request);
  let user = null;
  if (token) {
    try {
      const payload = verifyToken(env, token);
      user = await env.DB.prepare('SELECT id, username, nickname FROM users WHERE id = ?')
        .bind(payload.uid).first();
    } catch { /* 无效 token */ }
  }
  if (!user) {
    return jsonError('未登录', 401);
  }
  data.user = user;
  return context.next();
}

