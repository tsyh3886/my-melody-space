import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { db } from '../db.js';
import { normalizeTask } from '../validate.js';

const router = Router();
const COLS = 'id, user_id, title, category, due_date, priority, status, created_at';

function toClient(row) {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    dueDate: row.due_date,
    priority: row.priority,
    status: row.status,
    createdAt: row.created_at,
  };
}

router.get('/', (req, res) => {
  const rows = db.prepare(`SELECT ${COLS} FROM tasks WHERE user_id = ? ORDER BY created_at DESC`).all(req.user.id);
  res.json(rows.map(toClient));
});

router.post('/', (req, res) => {
  const r = normalizeTask(req.body || {}, { requireTitle: true });
  if (r.error) return res.status(400).json({ error: r.error });
  const v = r.value;
  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare('INSERT INTO tasks (id, user_id, title, category, due_date, priority, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(id, req.user.id, v.title, v.category ?? '其他', v.dueDate ?? null, v.priority ?? '中', v.status ?? '待完成', now);
  res.status(201).json(toClient(db.prepare(`SELECT ${COLS} FROM tasks WHERE id = ?`).get(id)));
});

router.put('/:id', (req, res) => {
  const row = db.prepare(`SELECT ${COLS} FROM tasks WHERE id = ? AND user_id = ?`).get(req.params.id, req.user.id);
  if (!row) return res.status(404).json({ error: '任务不存在' });
  const r = normalizeTask(req.body || {});
  if (r.error) return res.status(400).json({ error: r.error });
  const v = r.value;
  db.prepare('UPDATE tasks SET title = ?, category = ?, due_date = ?, priority = ?, status = ? WHERE id = ?')
    .run(v.title ?? row.title, v.category ?? row.category, v.dueDate !== undefined ? v.dueDate : row.due_date, v.priority ?? row.priority, v.status ?? row.status, row.id);
  res.json(toClient(db.prepare(`SELECT ${COLS} FROM tasks WHERE id = ?`).get(row.id)));
});

router.delete('/:id', (req, res) => {
  const info = db.prepare('DELETE FROM tasks WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  if (info.changes === 0) return res.status(404).json({ error: '任务不存在' });
  res.json({ ok: true });
});

export default router;