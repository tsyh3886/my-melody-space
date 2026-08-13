import { json, jsonError, parseBody } from '../_lib/helpers.js';
import { normalizeTask, normalizeGoal, normalizeNote } from '../_lib/validate.js';

// 旧版数据存在已废弃的「进行中」状态，导入时统一转为「待完成」
function coerceLegacy(v) {
  if (v && typeof v === 'object' && v.status === '进行中') v = { ...v, status: '待完成' };
  return v;
}

// 一次性导入：把旧版 localStorage 导出的数据并入当前账号（重新生成 id）
export async function onRequestPost(context) {
  const { env, data } = context;
  const body = await parseBody(context.request);
  const lists = [
    { key: 'tasks', normalize: (v) => normalizeTask(coerceLegacy(v), { requireTitle: true }), insert: insertTaskStmt },
    { key: 'goals', normalize: (v) => normalizeGoal(v, { requireName: true }), insert: insertGoalStmt },
    { key: 'notes', normalize: (v) => normalizeNote(v, { requireTitle: true }), insert: insertNoteStmt },
  ];
  for (const { key } of lists) {
    const arr = body[key];
    if (arr !== undefined && !Array.isArray(arr)) return jsonError(`导入数据中 ${key} 必须是数组`, 400);
  }
  const plans = [];
  for (const { key, normalize } of lists) {
    const arr = body[key];
    if (!Array.isArray(arr) || arr.length === 0) continue;
    for (const item of arr) {
      const r = normalize(item);
      if (r.error) return jsonError(`导入数据中 ${key} 存在无效项：${r.error}`, 400);
      plans.push({ key, value: r.value });
    }
  }
  const now = new Date().toISOString();
  const stmts = plans.map(({ key, value }) => {
    const insert = lists.find((l) => l.key === key).insert;
    return insert(env, value, data.user.id, now);
  });
  if (stmts.length > 0) await env.DB.batch(stmts);
  const counts = {};
  for (const { key } of lists) counts[key] = Array.isArray(body[key]) ? body[key].length : 0;
  return json({ ok: true, imported: counts });
}

function insertTaskStmt(env, v, userId, now) {
  // 注意：导入时任务不保留旧 goal_id（目标 id 已重新生成，避免悬空引用）
  return env.DB.prepare('INSERT INTO tasks (id, user_id, title, category, due_date, priority, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(crypto.randomUUID(), userId, v.title, v.category ?? '其他', v.dueDate ?? null, v.priority ?? '中', v.status ?? '待完成', now);
}

function insertGoalStmt(env, v, userId, now) {
  return env.DB.prepare('INSERT INTO goals (id, user_id, name, description, deadline, progress, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(crypto.randomUUID(), userId, v.name, v.description ?? '', v.deadline ?? null, v.progress ?? 0, now);
}

function insertNoteStmt(env, v, userId, now) {
  return env.DB.prepare('INSERT INTO notes (id, user_id, title, content, tags, category, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(crypto.randomUUID(), userId, v.title, v.content ?? '', v.tags ?? '', v.category ?? '其他', now);
}
