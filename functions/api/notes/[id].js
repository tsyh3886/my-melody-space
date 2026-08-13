import { json, jsonError, parseBody } from '../../_lib/helpers.js';
import { normalizeNote } from '../../_lib/validate.js';

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

export async function onRequestPut(context) {
  const { env, data, params } = context;
  const row = await env.DB.prepare(`SELECT ${COLS} FROM notes WHERE id = ? AND user_id = ?`).bind(params.id, data.user.id).first();
  if (!row) return jsonError('笔记不存在', 404);
  const r = normalizeNote(await parseBody(context.request));
  if (r.error) return jsonError(r.error, 400);
  const v = r.value;
  await env.DB.prepare('UPDATE notes SET title = ?, content = ?, tags = ?, category = ? WHERE id = ?')
    .bind(v.title ?? row.title, v.content !== undefined ? v.content : row.content, v.tags !== undefined ? v.tags : row.tags, v.category ?? row.category, row.id).run();
  const updated = await env.DB.prepare(`SELECT ${COLS} FROM notes WHERE id = ?`).bind(row.id).first();
  return json(toClient(updated));
}

export async function onRequestDelete(context) {
  const { env, data, params } = context;
  const info = await env.DB.prepare('DELETE FROM notes WHERE id = ? AND user_id = ?').bind(params.id, data.user.id).run();
  if (info.meta.changes === 0) return jsonError('笔记不存在', 404);
  return json({ ok: true });
}
