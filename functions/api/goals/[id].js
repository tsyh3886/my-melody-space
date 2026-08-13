import { json, jsonError, parseBody } from '../../_lib/helpers.js';
import { normalizeGoal } from '../../_lib/validate.js';

const COLS = 'id, user_id, name, description, deadline, progress, created_at';

function toClient(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    deadline: row.deadline,
    progress: row.progress,
    createdAt: row.created_at,
  };
}

async function withProgress(env, row, userId) {
  const s = await env.DB.prepare("SELECT COUNT(*) AS c, SUM(CASE WHEN status = '已完成' THEN 1 ELSE 0 END) AS d FROM tasks WHERE goal_id = ? AND user_id = ?").bind(row.id, userId).first();
  const total = s.c || 0;
  const done = s.d || 0;
  return {
    ...toClient(row),
    progress: total > 0 ? Math.round((done / total) * 100) : 0,
    subtaskCount: total,
    subtaskDone: done,
  };
}

export async function onRequestPut(context) {
  const { env, data, params } = context;
  const row = await env.DB.prepare(`SELECT ${COLS} FROM goals WHERE id = ? AND user_id = ?`).bind(params.id, data.user.id).first();
  if (!row) return jsonError('目标不存在', 404);
  const body = await parseBody(context.request);
  delete body.progress; // 进度不再手动设置
  const r = normalizeGoal(body);
  if (r.error) return jsonError(r.error, 400);
  const v = r.value;
  await env.DB.prepare('UPDATE goals SET name = ?, description = ?, deadline = ? WHERE id = ?')
    .bind(v.name ?? row.name, v.description !== undefined ? v.description : row.description, v.deadline !== undefined ? v.deadline : row.deadline, row.id).run();
  const updated = await env.DB.prepare(`SELECT ${COLS} FROM goals WHERE id = ?`).bind(row.id).first();
  return json(await withProgress(env, updated, data.user.id));
}

export async function onRequestDelete(context) {
  const { env, data, params } = context;
  const info = await env.DB.prepare('DELETE FROM goals WHERE id = ? AND user_id = ?').bind(params.id, data.user.id).run();
  if (info.meta.changes === 0) return jsonError('目标不存在', 404);
  return json({ ok: true });
}
