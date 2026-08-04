import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { db } from '../db.js';
import { normalizeTask, normalizeGoal, normalizeNote } from '../validate.js';

const router = Router();

// 旧版数据存在已废弃的「进行中」状态，导入时统一转为「待完成」
function coerceLegacy(v) {
  if (v && typeof v === 'object' && v.status === '进行中') v = { ...v, status: '待完成' };
  return v;
}

// 一次性导入：把旧版 localStorage 导出的数据并入当前账号（重新生成 id）
router.post('/', (req, res) => {
  const body = req.body || {};
  const lists = [
    { key: 'tasks', normalize: (v) => normalizeTask(coerceLegacy(v), { requireTitle: true }), insert: insertTask },
    { key: 'goals', normalize: (v) => normalizeGoal(v, { requireName: true }), insert: insertGoal },
    { key: 'notes', normalize: (v) => normalizeNote(v, { requireTitle: true }), insert: insertNote },
  ];
  for (const { key, normalize, insert } of lists) {
    const arr = body[key];
    if (arr !== undefined && !Array.isArray(arr)) {
      return res.status(400).json({ error: `导入数据中 ${key} 必须是数组` });
    }
    if (!Array.isArray(arr) || arr.length === 0) continue;
    for (const item of arr) {
      const r = normalize(item);
      if (r.error) return res.status(400).json({ error: `导入数据中 ${key} 存在无效项：${r.error}` });
    }
  }
  const now = new Date().toISOString();
  db.exec('BEGIN');
  try {
    for (const { key, normalize, insert } of lists) {
      const arr = body[key];
      if (!Array.isArray(arr) || arr.length === 0) continue;
      for (const item of arr) {
        const { value } = normalize(item);
        insert(value, req.user.id, now);
      }
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    console.error('[import]', err);
    return res.status(500).json({ error: '导入失败，已回滚' });
  }
  const counts = {};
  for (const { key } of lists) counts[key] = Array.isArray(body[key]) ? body[key].length : 0;
  res.json({ ok: true, imported: counts });
});

function insertTask(v, userId, now) {
  db.prepare('INSERT INTO tasks (id, user_id, title, category, due_date, priority, status, goal_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(randomUUID(), userId, v.title, v.category ?? '其他', v.dueDate ?? null, v.priority ?? '中', v.status ?? '待完成', v.goalId ?? null, now);
}

function insertGoal(v, userId, now) {
  db.prepare('INSERT INTO goals (id, user_id, name, description, deadline, progress, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(randomUUID(), userId, v.name, v.description ?? '', v.deadline ?? null, v.progress ?? 0, now);
}

function insertNote(v, userId, now) {
  db.prepare('INSERT INTO notes (id, user_id, title, content, tags, category, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(randomUUID(), userId, v.title, v.content ?? '', v.tags ?? '', v.category ?? '其他', now);
}

export default router;