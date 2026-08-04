import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { db } from '../db.js';
import { normalizeNote } from '../validate.js';

const router = Router();
const COLS = 'id, user_id, title, content, tags, category, created_at';

function toClient(row) {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    tags: row.tags,
    category: row.category,
    createdAt: row.created_at,
  };
}

router.get('/', (req, res) => {
  const rows = db.prepare(`SELECT ${COLS} FROM notes WHERE user_id = ? ORDER BY created_at DESC`).all(req.user.id);
  res.json(rows.map(toClient));
});

router.post('/', (req, res) => {
  const r = normalizeNote(req.body || {}, { requireTitle: true });
  if (r.error) return res.status(400).json({ error: r.error });
  const v = r.value;
  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare('INSERT INTO notes (id, user_id, title, content, tags, category, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(id, req.user.id, v.title, v.content ?? '', v.tags ?? '', v.category ?? '其他', now);
  res.status(201).json(toClient(db.prepare(`SELECT ${COLS} FROM notes WHERE id = ?`).get(id)));
});

router.put('/:id', (req, res) => {
  const row = db.prepare(`SELECT ${COLS} FROM notes WHERE id = ? AND user_id = ?`).get(req.params.id, req.user.id);
  if (!row) return res.status(404).json({ error: '笔记不存在' });
  const r = normalizeNote(req.body || {});
  if (r.error) return res.status(400).json({ error: r.error });
  const v = r.value;
  db.prepare('UPDATE notes SET title = ?, content = ?, tags = ?, category = ? WHERE id = ?')
    .run(v.title ?? row.title, v.content !== undefined ? v.content : row.content, v.tags !== undefined ? v.tags : row.tags, v.category ?? row.category, row.id);
  res.json(toClient(db.prepare(`SELECT ${COLS} FROM notes WHERE id = ?`).get(row.id)));
});

router.delete('/:id', (req, res) => {
  const info = db.prepare('DELETE FROM notes WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  if (info.changes === 0) return res.status(404).json({ error: '笔记不存在' });
  res.json({ ok: true });
});

export default router;