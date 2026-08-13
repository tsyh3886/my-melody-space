import { json } from '../_lib/helpers.js';

// 清空当前账号的全部数据
export async function onRequestDelete(context) {
  const { env, data } = context;
  await env.DB.batch([
    env.DB.prepare('DELETE FROM tasks WHERE user_id = ?').bind(data.user.id),
    env.DB.prepare('DELETE FROM goals WHERE user_id = ?').bind(data.user.id),
    env.DB.prepare('DELETE FROM notes WHERE user_id = ?').bind(data.user.id),
  ]);
  return json({ ok: true });
}
