import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { db } from '../db.js';
import { normalizeGoal } from '../validate.js';

const router = Router();
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
function withProgress(row, userId) {
  const s = db.prepare("SELECT COUNT(*) AS c, SUM(CASE WHEN status = '已完成' THEN 1 ELSE 0 END) AS d FROM tasks WHERE goal_id = ? AND user_id = ?").get(row.id, userId);
  const total = s.c || 0;
  const done = s.d || 0;
  return {
    ...toClient(row),
    progress: total > 0 ? Math.round((done / total) * 100) : 0,
    subtaskCount: total,
    subtaskDone: done,
  };
}

router.get('/', (req, res) => {
  const rows = db.prepare(`SELECT ${COLS} FROM goals WHERE user_id = ? ORDER BY created_at DESC`).all(req.user.id);
  res.json(rows.map((row) => withProgress(row, req.user.id)));
});

router.post('/', (req, res) => {
  const body = { ...(req.body || {}) };
  delete body.progress; // 进度不再手动设置
  const r = normalizeGoal(body, { requireName: true });
  if (r.error) return res.status(400).json({ error: r.error });
  const v = r.value;
  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare('INSERT INTO goals (id, user_id, name, description, deadline, progress, created_at) VALUES (?, ?, ?, ?, ?, 0, ?)')
    .run(id, req.user.id, v.name, v.description ?? '', v.deadline ?? null, now);
  res.status(201).json(withProgress(db.prepare(`SELECT ${COLS} FROM goals WHERE id = ?`).get(id), req.user.id));
});

router.put('/:id', (req, res) => {
  const row = db.prepare(`SELECT ${COLS} FROM goals WHERE id = ? AND user_id = ?`).get(req.params.id, req.user.id);
  if (!row) return res.status(404).json({ error: '目标不存在' });
  const body = { ...(req.body || {}) };
  delete body.progress; // 进度不再手动设置
  const r = normalizeGoal(body);
  if (r.error) return res.status(400).json({ error: r.error });
  const v = r.value;
  db.prepare('UPDATE goals SET name = ?, description = ?, deadline = ? WHERE id = ?')
    .run(v.name ?? row.name, v.description !== undefined ? v.description : row.description, v.deadline !== undefined ? v.deadline : row.deadline, row.id);
  res.json(withProgress(db.prepare(`SELECT ${COLS} FROM goals WHERE id = ?`).get(row.id), req.user.id));
});

router.delete('/:id', (req, res) => {
  const info = db.prepare('DELETE FROM goals WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  if (info.changes === 0) return res.status(404).json({ error: '目标不存在' });
  res.json({ ok: true });
});

export default router;