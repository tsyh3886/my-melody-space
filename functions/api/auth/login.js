import { json, jsonError, parseBody } from '../../_lib/helpers.js';
import { findUserByUsername, publicUser, signToken, authCookie, verifyPassword } from '../../_lib/auth.js';

export async function onRequestPost(context) {
  const body = await parseBody(context.request);
  const username = typeof body.username === 'string' ? body.username.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (!username || !password) return jsonError('请输入用户名和密码', 400);
  const user = await findUserByUsername(context.env, username);
  if (!user || !(await verifyPassword(user, password))) {
    return jsonError('用户名或密码错误', 401);
  }
  return json({ user: publicUser(user) }, 200, { 'Set-Cookie': authCookie(signToken(context.env, user)) });
}
