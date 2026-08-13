import { json, jsonError, parseBody } from '../_lib/helpers.js';
import { normalizeNote } from '../_lib/validate.js';

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

export async function onRequestGet(context) {
  const rows = await context.env.DB.prepare(`SELECT ${COLS} FROM notes WHERE user_id = ? ORDER BY created_at DESC`).bind(context.data.user.id).all();
  return json(rows.results.map(toClient));
}

export async function onRequestPost(context) {
  const r = normalizeNote(await parseBody(context.request), { requireTitle: true });
  if (r.error) return jsonError(r.error, 400);
  const v = r.value;
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await context.env.DB.prepare('INSERT INTO notes (id, user_id, title, content, tags, category, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(id, context.data.user.id, v.title, v.content ?? '', v.tags ?? '', v.category ?? '其他', now).run();
  const row = await context.env.DB.prepare(`SELECT ${COLS} FROM notes WHERE id = ?`).bind(id).first();
  return json(toClient(row), 201);
}
