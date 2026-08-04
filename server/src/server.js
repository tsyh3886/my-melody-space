import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { requireAuth } from './auth.js';
import authRoutes from './routes/auth.js';
import taskRoutes from './routes/tasks.js';
import goalRoutes from './routes/goals.js';
import noteRoutes from './routes/notes.js';
import importRoutes from './routes/import.js';
import dataRoutes from './routes/data.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '..', '..', 'public');

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api/auth', authRoutes);
app.use('/api/tasks', requireAuth, taskRoutes);
app.use('/api/goals', requireAuth, goalRoutes);
app.use('/api/notes', requireAuth, noteRoutes);
app.use('/api/import', requireAuth, importRoutes);
app.use('/api/data', requireAuth, dataRoutes);
app.use('/api', (req, res) => res.status(404).json({ error: '接口不存在' }));

app.use(express.static(publicDir, { index: 'index.html', maxAge: '1h' }));

app.use((err, req, res, next) => {
  console.error('[server]', err);
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: '请求体不是合法 JSON' });
  if (err.type === 'entity.too.large') return res.status(413).json({ error: '请求体过大' });
  res.status(500).json({ error: '服务器内部错误' });
});

const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
  console.log(`[mms] 数字空间服务已启动: http://localhost:${port}`);
  console.log(`[mms] 静态目录: ${publicDir}`);
});