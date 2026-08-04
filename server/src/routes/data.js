import { Router } from 'express';
import { db } from '../db.js';

const router = Router();

// 清空当前账号的全部数据
router.delete('/', (req, res) => {
  db.exec('BEGIN');
  try {
    for (const table of ['tasks', 'goals', 'notes']) {
      db.prepare(`DELETE FROM ${table} WHERE user_id = ?`).run(req.user.id);
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    console.error('[clear]', err);
    return res.status(500).json({ error: '清空失败' });
  }
  res.json({ ok: true });
});

export default router;