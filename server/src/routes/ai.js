import { Router } from 'express';
import { chatJSON, llmStatus, llmConfigured } from '../llm.js';

const router = Router();

// 真实 AI 能力状态（设置页展示用）
router.get('/status', (req, res) => {
  res.json(llmStatus());
});

// 统一 AI 入口：action = breakdown | plan
// 未配置 Key 或调用失败时返回 503，由前端回退到本地规则引擎
router.post('/', async (req, res) => {
  const { action } = req.body || {};
  try {
    if (action === 'breakdown') return await handleBreakdown(req, res);
    if (action === 'plan') return await handlePlan(req, res);
    return res.status(400).json({ error: '未知的 AI 操作' });
  } catch (err) {
    if (err.code === 'LLM_NOT_CONFIGURED') return res.status(503).json({ error: err.message });
    console.error('[ai]', err);
    return res.status(502).json({ error: err.message || 'AI 服务暂不可用' });
  }
});

async function handleBreakdown(req, res) {
  const name = typeof req.body.goalName === 'string' ? req.body.goalName.trim() : '';
  const description = typeof req.body.goalDescription === 'string' ? req.body.goalDescription.trim().slice(0, 500) : '';
  if (!name || name.length > 100) return res.status(400).json({ error: '目标名称需为 1-100 个字符' });
  if (!llmConfigured()) throw Object.assign(new Error('未配置 LLM_API_KEY，已使用本地规则'), { code: 'LLM_NOT_CONFIGURED' });

  const system = '你是个人效率助手，擅长把模糊的目标拆解成具体可执行的小任务。你只输出 JSON，不输出任何其他内容。';
  const user = `请把下面的目标拆解为 3-5 个可执行子任务。\n目标：${name}\n描述：${description || '（无）'}\n要求：每条以动词开头、不超过 25 个字、具体可执行、不包含序号。\n输出格式：{"steps":["子任务1","子任务2","子任务3"]}`;
  const data = await chatJSON(system, user, { temperature: 0.5 });
  const raw = Array.isArray(data?.steps) ? data.steps : [];
  const steps = [...new Set(raw.map((s) => String(s).trim()).filter((s) => s && s.length <= 30))].slice(0, 5);
  if (steps.length === 0) throw new Error('AI 拆解结果为空');
  res.json({ steps });
}

async function handlePlan(req, res) {
  const tasks = Array.isArray(req.body.tasks) ? req.body.tasks.slice(0, 50) : [];
  const today = /^\d{4}-\d{2}-\d{2}$/.test(req.body.today || '') ? req.body.today : new Date().toISOString().slice(0, 10);
  if (tasks.length === 0) return res.status(400).json({ error: '没有可规划的任务' });
  if (!llmConfigured()) throw Object.assign(new Error('未配置 LLM_API_KEY，已使用本地规则'), { code: 'LLM_NOT_CONFIGURED' });

  const ids = new Set(tasks.map((t) => String(t.id)));
  const payload = tasks.map((t) => ({
    id: String(t.id),
    title: String(t.title || '').slice(0, 60),
    priority: t.priority || '中',
    dueDate: t.dueDate || null,
    status: t.status || '待完成',
  }));
  const system = '你是时间规划助手。根据用户的任务列表生成今天的安排建议。你只输出 JSON，不输出任何其他内容。';
  const user = `今天是 ${today}。我的任务：\n${JSON.stringify(payload, null, 2)}\n请按以下规则规划：高优先级或今天到期的任务放上午，中等优先级放下午，低优先级放晚上；每段最多 5 条；只使用给定任务的 id，不允许编造。\n输出格式：{"morning":["id1","id2"],"afternoon":["id3"],"evening":["id4"],"suggestion":"一句话建议（不超过 40 字）"}`;
  const data = await chatJSON(system, user, { temperature: 0.4 });
  const pick = (key) => (Array.isArray(data?.[key]) ? data[key].map((v) => String(v)).filter((v) => ids.has(v)).slice(0, 5) : []);
  const suggestion = typeof data?.suggestion === 'string' ? data.suggestion.trim().slice(0, 80) : '';
  res.json({ morning: pick('morning'), afternoon: pick('afternoon'), evening: pick('evening'), suggestion });
}

export default router;