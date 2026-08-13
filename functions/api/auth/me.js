import { json, jsonError, parseBody } from '../../_lib/helpers.js';
import { publicUser } from '../../_lib/auth.js';

export function onRequestGet(context) {
  return json({ user: publicUser(context.data.user) });
}

export async function onRequestPut(context) {
  const body = await parseBody(context.request);
  const nickname = typeof body.nickname === 'string' ? body.nickname.trim() : '';
  if (!nickname || nickname.length > 20) return jsonError('昵称需为 1-20 个字符', 400);
  await context.env.DB.prepare('UPDATE users SET nickname = ? WHERE id = ?')
    .bind(nickname, context.data.user.id).run();
  const user = await context.env.DB.prepare('SELECT id, username, nickname FROM users WHERE id = ?')
    .bind(context.data.user.id).first();
  return json({ user: publicUser(user) });
}
