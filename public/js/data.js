// 数据层：与后端 API 通信并维护全局状态
export const state = { user: null, tasks: [], goals: [], notes: [] };

let onUnauthorized = null;
export function setUnauthorizedHandler(fn) { onUnauthorized = fn; }

export async function api(path, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch(path, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    const err = new Error('网络连接失败，请检查网络');
    err.offline = true;
    throw err;
  }
  let data = null;
  try { data = await res.json(); } catch { /* 非 JSON 响应 */ }
  if (res.status === 401) {
    if (onUnauthorized) onUnauthorized();
    throw new Error((data && data.error) || '登录已过期，请重新登录');
  }
  if (!res.ok) throw new Error((data && data.error) || '请求失败（' + res.status + '）');
  return data;
}

export async function checkSession() {
  try { const r = await api('/api/auth/me'); state.user = r.user; return r.user; }
  catch { return null; }
}
export async function login(username, password) {
  const r = await api('/api/auth/login', { method: 'POST', body: { username, password } });
  state.user = r.user;
  return r.user;
}
export async function register(username, password, nickname) {
  const r = await api('/api/auth/register', { method: 'POST', body: { username, password, nickname } });
  state.user = r.user;
  return r.user;
}
export async function logout() {
  await api('/api/auth/logout', { method: 'POST' });
  state.user = null;
  state.tasks = [];
  state.goals = [];
  state.notes = [];
}
export async function updateNickname(nickname) {
  const r = await api('/api/auth/me', { method: 'PUT', body: { nickname } });
  state.user = r.user;
  return r.user;
}

export async function fetchAllData() {
  const [tasks, goals, notes] = await Promise.all([
    api('/api/tasks'), api('/api/goals'), api('/api/notes'),
  ]);
  state.tasks = tasks;
  state.goals = goals;
  state.notes = notes;
}

export async function createTask(t) { const r = await api('/api/tasks', { method: 'POST', body: t }); state.tasks.unshift(r); return r; }
export async function updateTask(id, patch) { const r = await api('/api/tasks/' + id, { method: 'PUT', body: patch }); state.tasks = state.tasks.map((x) => (x.id === id ? r : x)); return r; }
export async function deleteTask(id) { await api('/api/tasks/' + id, { method: 'DELETE' }); state.tasks = state.tasks.filter((x) => x.id !== id); }

export async function createGoal(g) { const r = await api('/api/goals', { method: 'POST', body: g }); state.goals.unshift(r); return r; }
export async function updateGoal(id, patch) { const r = await api('/api/goals/' + id, { method: 'PUT', body: patch }); state.goals = state.goals.map((x) => (x.id === id ? r : x)); return r; }
export async function deleteGoal(id) { await api('/api/goals/' + id, { method: 'DELETE' }); state.goals = state.goals.filter((x) => x.id !== id); }

export async function createNote(n) { const r = await api('/api/notes', { method: 'POST', body: n }); state.notes.unshift(r); return r; }
export async function updateNote(id, patch) { const r = await api('/api/notes/' + id, { method: 'PUT', body: patch }); state.notes = state.notes.map((x) => (x.id === id ? r : x)); return r; }
export async function deleteNote(id) { await api('/api/notes/' + id, { method: 'DELETE' }); state.notes = state.notes.filter((x) => x.id !== id); }

export async function importLegacy(payload) { return api('/api/import', { method: 'POST', body: payload }); }
export async function clearAllData() {
  await api('/api/data', { method: 'DELETE' });
  state.tasks = [];
  state.goals = [];
  state.notes = [];
}

export function exportBackup() {
  return JSON.stringify({ tasks: state.tasks, goals: state.goals, notes: state.notes }, null, 2);
}

// 读取旧版单文件应用留在 localStorage 的数据（key: myMelodyDS）
export function readLegacyLocalData() {
  try {
    const raw = localStorage.getItem('myMelodyDS');
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (!p || typeof p !== 'object') return null;
    return {
      tasks: Array.isArray(p.tasks) ? p.tasks : [],
      goals: Array.isArray(p.goals) ? p.goals : [],
      notes: Array.isArray(p.notes) ? p.notes : [],
    };
  } catch { return null; }
}