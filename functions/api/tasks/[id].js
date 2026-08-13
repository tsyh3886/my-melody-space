import { json, jsonError, parseBody } from '../../_lib/helpers.js';
import { normalizeTask } from '../../_lib/validate.js';
import { ensureGoalOwned } from '../tasks.js';

const COLS = 'id, user_id, title, category, due_date, priority, status, goal_id, created_at';

function toClient(row) {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    dueDate: row.due_date,
    priority: row.priority,
    status: row.status,
    goalId: row.goal_id ?? null,
    createdAt: row.created_at,
  };
}

export async function onRequestPut(context) {
  const { env, data, params } = context;
  const row = await env.DB.prepare(`SELECT ${COLS} FROM tasks WHERE id = ? AND user_id = ?`).bind(params.id, data.user.id).first();
  if (!row) return jsonError('任务不存在', 404);
  const r = normalizeTask(await parseBody(context.request));
  if (r.error) return jsonError(r.error, 400);
  const v = r.value;
  if (v.goalId !== undefined && !(await ensureGoalOwned(env, v.goalId, data.user.id))) return jsonError('目标不存在', 400);
  await env.DB.prepare('UPDATE tasks SET title = ?, category = ?, due_date = ?, priority = ?, status = ?, goal_id = ? WHERE id = ?')
    .bind(v.title ?? row.title, v.category ?? row.category, v.dueDate !== undefined ? v.dueDate : row.due_date, v.priority ?? row.priority, v.status ?? row.status, v.goalId !== undefined ? v.goalId : row.goal_id, row.id).run();
  const updated = await env.DB.prepare(`SELECT ${COLS} FROM tasks WHERE id = ?`).bind(row.id).first();
  return json(toClient(updated));
}

export async function onRequestDelete(context) {
  const { env, data, params } = context;
  const info = await env.DB.prepare('DELETE FROM tasks WHERE id = ? AND user_id = ?').bind(params.id, data.user.id).run();
  if (info.meta.changes === 0) return jsonError('任务不存在', 404);
  return json({ ok: true });
}
