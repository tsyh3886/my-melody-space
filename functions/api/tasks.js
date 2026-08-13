import { json, jsonError, parseBody } from '../_lib/helpers.js';
import { normalizeTask } from '../_lib/validate.js';

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

export async function ensureGoalOwned(env, goalId, userId) {
  if (goalId == null) return true;
  const g = await env.DB.prepare('SELECT id FROM goals WHERE id = ? AND user_id = ?').bind(goalId, userId).first();
  return !!g;
}

export async function onRequestGet(context) {
  const rows = await context.env.DB.prepare(`SELECT ${COLS} FROM tasks WHERE user_id = ? ORDER BY created_at DESC`).bind(context.data.user.id).all();
  return json(rows.results.map(toClient));
}

export async function onRequestPost(context) {
  const body = await parseBody(context.request);
  const r = normalizeTask(body, { requireTitle: true });
  if (r.error) return jsonError(r.error, 400);
  const v = r.value;
  if (!(await ensureGoalOwned(context.env, v.goalId, context.data.user.id))) return jsonError('目标不存在', 400);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await context.env.DB.prepare(
    'INSERT INTO tasks (id, user_id, title, category, due_date, priority, status, goal_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(id, context.data.user.id, v.title, v.category ?? '其他', v.dueDate ?? null, v.priority ?? '中', v.status ?? '待完成', v.goalId ?? null, now).run();
  const row = await context.env.DB.prepare(`SELECT ${COLS} FROM tasks WHERE id = ?`).bind(id).first();
  return json(toClient(row), 201);
}
