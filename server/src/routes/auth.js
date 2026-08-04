import { Router } from 'express';
import { db } from '../db.js';
import { createUser, findUserByUsername, publicUser, setAuthCookie, clearAuthCookie, signToken, requireAuth, verifyPassword } from '../auth.js';
import { validateRegister } from '../validate.js';

const router = Router();

router.post('/register', (req, res) => {
  const body = req.body || {};
  const username = typeof body.username === 'string' ? body.username.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const nickname = typeof body.nickname === 'string' ? body.nickname.trim() : '';
  const err = validateRegister({ username, password, nickname });
  if (err) return res.status(400).json({ error: err });
  if (findUserByUsername(username)) return res.status(409).json({ error: '用户名已被注册' });
  const user = createUser({ username, password, nickname });
  setAuthCookie(res, signToken(user));
  res.status(201).json({ user: publicUser(user) });
});

router.post('/login', (req, res) => {
  const body = req.body || {};
  const username = typeof body.username === 'string' ? body.username.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (!username || !password) return res.status(400).json({ error: '请输入用户名和密码' });
  const user = findUserByUsername(username);
  if (!user || !verifyPassword(user, password)) {
    return res.status(401).json({ error: '用户名或密码错误' });
  }
  setAuthCookie(res, signToken(user));
  res.json({ user: publicUser(user) });
});

router.post('/logout', (req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

router.put('/me', requireAuth, (req, res) => {
  const nickname = typeof (req.body || {}).nickname === 'string' ? req.body.nickname.trim() : '';
  if (!nickname || nickname.length > 20) return res.status(400).json({ error: '昵称需为 1-20 个字符' });
  db.prepare('UPDATE users SET nickname = ? WHERE id = ?').run(nickname, req.user.id);
  const user = db.prepare('SELECT id, username, nickname FROM users WHERE id = ?').get(req.user.id);
  res.json({ user: publicUser(user) });
});

export default router;