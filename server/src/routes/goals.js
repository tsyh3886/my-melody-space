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

router.get('/', (req, res) => {
  const rows = db.prepare(`SELECT ${COLS} FROM goals WHERE user_id = ? ORDER BY created_at DESC`).all(req.user.id);
  res.json(rows.map(toClient));
});

router.post('/', (req, res) => {
  const r = normalizeGoal(req.body || {}, { requireName: true });
  if (r.error) return res.status(400).json({ error: r.error });
  const v = r.value;
  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare('INSERT INTO goals (id, user_id, name, description, deadline, progress, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(id, req.user.id, v.name, v.description ?? '', v.deadline ?? null, v.progress ?? 0, now);
  res.status(201).json(toClient(db.prepare(`SELECT ${COLS} FROM goals WHERE id = ?`).get(id)));
});

router.put('/:id', (req, res) => {
  const row = db.prepare(`SELECT ${COLS} FROM goals WHERE id = ? AND user_id = ?`).get(req.params.id, req.user.id);
  if (!row) return res.status(404).json({ error: '目标不存在' });
  const r = normalizeGoal(req.body || {});
  if (r.error) return res.status(400).json({ error: r.error });
  const v = r.value;
  db.prepare('UPDATE goals SET name = ?, description = ?, deadline = ?, progress = ? WHERE id = ?')
    .run(v.name ?? row.name, v.description !== undefined ? v.description : row.description, v.deadline !== undefined ? v.deadline : row.deadline, v.progress !== undefined ? v.progress : row.progress, row.id);
  res.json(toClient(db.prepare(`SELECT ${COLS} FROM goals WHERE id = ?`).get(row.id)));
});

router.delete('/:id', (req, res) => {
  const info = db.prepare('DELETE FROM goals WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  if (info.changes === 0) return res.status(404).json({ error: '目标不存在' });
  res.json({ ok: true });
});

export default router;