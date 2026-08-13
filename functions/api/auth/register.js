import { json, jsonError, parseBody } from '../../_lib/helpers.js';
import { createUser, findUserByUsername, publicUser, signToken, authCookie } from '../../_lib/auth.js';
import { validateRegister } from '../../_lib/validate.js';

export async function onRequestPost(context) {
  const body = await parseBody(context.request);
  const username = typeof body.username === 'string' ? body.username.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const nickname = typeof body.nickname === 'string' ? body.nickname.trim() : '';
  const err = validateRegister({ username, password, nickname });
  if (err) return jsonError(err, 400);
  if (await findUserByUsername(context.env, username)) {
    return jsonError('用户名已被注册', 409);
  }
  const user = await createUser(context.env, { username, password, nickname });
  return json({ user: publicUser(user) }, 201, { 'Set-Cookie': authCookie(signToken(context.env, user)) });
}
