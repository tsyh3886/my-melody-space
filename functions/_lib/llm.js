// LLM 客户端：兼容任意 OpenAI 风格接口（DeepSeek / OpenAI / Moonshot 等）
// 通过环境变量配置：LLM_API_KEY / LLM_BASE_URL / LLM_MODEL
// 未配置 Key 时不发起请求，由调用方回退到本地规则引擎

export function llmConfigured(env) {
  return !!(env.LLM_API_KEY || '');
}

export function llmStatus(env) {
  return {
    configured: llmConfigured(env),
    model: env.LLM_MODEL || 'deepseek-chat',
    baseUrl: (env.LLM_BASE_URL || 'https://api.deepseek.com').replace(/\/+$/, ''),
  };
}

function parseJSON(text) {
  if (!text) throw new Error('AI 返回为空');
  const t = String(text).trim();
  try { return JSON.parse(t); } catch { /* 继续尝试提取 */ }
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fence ? fence[1].trim() : t;
  try { return JSON.parse(candidate); } catch { /* 继续尝试大括号提取 */ }
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try { return JSON.parse(candidate.slice(start, end + 1)); } catch { /* 最后兜底 */ }
  }
  throw new Error('AI 返回内容不是合法 JSON');
}

export async function chatJSON(env, system, user, { temperature = 0.4, timeoutMs = 25000 } = {}) {
  if (!llmConfigured(env)) {
    const err = new Error('未配置 LLM_API_KEY，已使用本地规则');
    err.code = 'LLM_NOT_CONFIGURED';
    throw err;
  }
  const baseUrl = (env.LLM_BASE_URL || 'https://api.deepseek.com').replace(/\/+$/, '');
  const model = env.LLM_MODEL || 'deepseek-chat';
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.LLM_API_KEY}` },
      body: JSON.stringify({
        model,
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
        temperature,
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`AI 服务错误 ${res.status}${detail ? '：' + detail.slice(0, 160) : ''}`);
    }
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content || '';
    return parseJSON(content);
  } finally {
    clearTimeout(timer);
  }
}
