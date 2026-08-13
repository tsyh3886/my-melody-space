import { json, jsonError, parseBody } from '../_lib/helpers.js';
import { normalizeGoal } from '../_lib/validate.js';

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

// 进度完全由子任务驱动：已完成子任务数 / 子任务总数，无子任务时为 0
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

export async function onRequestGet(context) {
  const rows = await context.env.DB.prepare(`SELECT ${COLS} FROM goals WHERE user_id = ? ORDER BY created_at DESC`).bind(context.data.user.id).all();
  const items = await Promise.all(rows.results.map((row) => withProgress(context.env, row, context.data.user.id)));
  return json(items);
}

export async function onRequestPost(context) {
  const body = await parseBody(context.request);
  delete body.progress; // 进度不再手动设置
  const r = normalizeGoal(body, { requireName: true });
  if (r.error) return jsonError(r.error, 400);
  const v = r.value;
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await context.env.DB.prepare('INSERT INTO goals (id, user_id, name, description, deadline, progress, created_at) VALUES (?, ?, ?, ?, ?, 0, ?)')
    .bind(id, context.data.user.id, v.name, v.description ?? '', v.deadline ?? null, now).run();
  const row = await context.env.DB.prepare(`SELECT ${COLS} FROM goals WHERE id = ?`).bind(id).first();
  return json(await withProgress(context.env, row, context.data.user.id), 201);
}
