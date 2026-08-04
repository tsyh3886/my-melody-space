// API 冒烟测试：在同一进程内启动服务并跑完整流程，失败则退出码非 0
import { fileURLToPath } from 'node:url';
process.env.PORT = '3100';
process.env.DB_PATH = fileURLToPath(new URL('../data/test.db', import.meta.url));
process.env.LLM_API_KEY = '';
// 每次测试用全新数据库
import fs from 'node:fs';
for (const suffix of ['', '-wal', '-shm']) {
  try { fs.unlinkSync(process.env.DB_PATH + suffix); } catch {}
}
const { default: _ } = await import('../src/server.js');

const BASE = 'http://localhost:3100';
let pass = 0, fail = 0;
let cookie = '';

function ok(name, cond, extra = '') {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name} ${extra}`); }
}

async function api(method, path, body, withCookie = true) {
  const headers = { 'Content-Type': 'application/json' };
  if (withCookie && cookie) headers.Cookie = cookie;
  const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  let json = null;
  try { json = await res.json(); } catch {}
  const setCookie = res.headers.get('set-cookie');
  if (setCookie && setCookie.includes('mms_token')) cookie = setCookie.split(';')[0];
  return { status: res.status, json, setCookie };
}

await new Promise((r) => setTimeout(r, 300));

console.log('== 鉴权 ==');
let r = await api('POST', '/api/auth/register', { username: 'testuser', password: 'secret123', nickname: '测试用户' }, false);
ok('注册成功', r.status === 201 && r.json.user.username === 'testuser', JSON.stringify(r.json));
ok('注册返回会话 Cookie', !!r.setCookie && r.setCookie.includes('mms_token'));

r = await api('POST', '/api/auth/register', { username: 'testuser', password: 'secret123', nickname: '重复' }, false);
ok('重复用户名被拒 409', r.status === 409);

r = await api('POST', '/api/auth/register', { username: 'ab', password: '123', nickname: '' }, false);
ok('非法注册参数被拒 400', r.status === 400);

r = await api('GET', '/api/auth/me');
ok('me 返回当前用户', r.status === 200 && r.json.user.nickname === '测试用户');

r = await api('PUT', '/api/auth/me', { nickname: '新昵称' });
ok('更新昵称成功', r.status === 200 && r.json.user.nickname === '新昵称');
r = await api('PUT', '/api/auth/me', { nickname: '  ' });
ok('空昵称被拒 400', r.status === 400);

r = await api('POST', '/api/auth/login', { username: 'testuser', password: 'wrongpass' }, false);
ok('错误密码被拒 401', r.status === 401);

console.log('== 任务 CRUD ==');
r = await api('POST', '/api/tasks', { title: '写周报', priority: '高', category: '工作', status: '待完成', dueDate: '2026-08-10' });
ok('创建任务 201', r.status === 201 && r.json.title === '写周报', JSON.stringify(r.json));
const taskId = r.json.id;
r = await api('POST', '/api/tasks', { title: '' });
ok('空标题被拒 400', r.status === 400);
r = await api('POST', '/api/tasks', { title: '旧状态', status: '进行中' });
ok('废弃状态「进行中」被拒 400', r.status === 400);
r = await api('GET', '/api/tasks');
ok('任务列表包含新任务', r.status === 200 && r.json.some((t) => t.id === taskId));
r = await api('PUT', `/api/tasks/${taskId}`, { status: '已完成', priority: '低' });
ok('更新任务成功', r.status === 200 && r.json.status === '已完成' && r.json.priority === '低', JSON.stringify(r.json));
r = await api('DELETE', `/api/tasks/${taskId}`);
ok('删除任务成功', r.status === 200);

console.log('== 目标/笔记 CRUD ==');
r = await api('POST', '/api/goals', { name: '学习英语', progress: 30, deadline: '2026-12-31' });
ok('创建目标 201（手动进度被忽略）', r.status === 201 && r.json.progress === 0, JSON.stringify(r.json));
const goalId = r.json.id;
r = await api('POST', '/api/tasks', { title: '背单词', goalId });
ok('创建子任务 201', r.status === 201 && r.json.goalId === goalId);
const sub1 = r.json.id;
r = await api('POST', '/api/tasks', { title: '练听力', goalId });
const sub2 = r.json.id;
r = await api('POST', '/api/tasks', { title: '非法目标子任务', goalId: 'not-exist' });
ok('不存在目标的子任务被拒 400', r.status === 400);
r = await api('PUT', `/api/tasks/${sub1}`, { status: '已完成' });
ok('子任务完成', r.status === 200 && r.json.status === '已完成');
r = await api('GET', '/api/goals');
const g0 = r.json.find((g) => g.id === goalId);
ok('进度自动统计 1/2 = 50%', g0.progress === 50 && g0.subtaskCount === 2 && g0.subtaskDone === 1, JSON.stringify(g0));
r = await api('PUT', `/api/goals/${goalId}`, { progress: 80 });
ok('手动进度被忽略', r.status === 200 && r.json.progress === 50);
r = await api('POST', '/api/notes', { title: '一个想法', content: '记录一下', tags: '灵感,笔记', category: '灵感' });
ok('创建笔记 201', r.status === 201 && r.json.category === '灵感');
const noteId = r.json.id;
r = await api('DELETE', `/api/notes/${noteId}`);
ok('删除笔记成功', r.status === 200);
r = await api('DELETE', `/api/goals/${goalId}`);
ok('删除目标 200', r.status === 200);
r = await api('GET', '/api/tasks');
ok('删除目标级联删除子任务', r.status === 200 && !r.json.some((t) => t.id === sub1 || t.id === sub2));

console.log('== 数据隔离 ==');
r = await api('POST', '/api/auth/register', { username: 'second', password: 'secret123', nickname: '二号' }, false);
r = await api('GET', '/api/tasks');
ok('用户间数据隔离', r.status === 200 && r.json.length === 0);
r = await api('POST', '/api/auth/logout');
ok('退出登录成功', r.status === 200);
r = await api('GET', '/api/auth/me');
ok('退出后 me 401', r.status === 401);

console.log('== 导入/清空 ==');
r = await api('POST', '/api/auth/login', { username: 'second', password: 'secret123' }, false);
r = await api('POST', '/api/import', {
  tasks: [{ title: '旧任务', priority: '中', category: '其他', status: '进行中' }],
  goals: [{ name: '旧目标', progress: 10 }],
  notes: [{ title: '旧笔记', content: 'x', category: '其他' }],
});
ok('导入成功（进行中自动转待完成）', r.status === 200 && r.json.imported.tasks === 1 && r.json.imported.goals === 1 && r.json.imported.notes === 1, JSON.stringify(r.json));
r = await api('POST', '/api/import', { tasks: [{ title: '' }] });
ok('无效导入被拒 400', r.status === 400);
r = await api('GET', '/api/tasks');
ok('导入数据可查询且状态归一', r.status === 200 && r.json.length === 1 && r.json[0].status === '待完成');
r = await api('DELETE', '/api/data');
ok('清空数据成功', r.status === 200);
r = await api('GET', '/api/tasks');
ok('清空后任务为空', r.status === 200 && r.json.length === 0);

console.log('== AI 接口（无 Key 时） ==');
r = await api('GET', '/api/ai/status');
ok('AI 状态返回未配置', r.status === 200 && r.json.configured === false, JSON.stringify(r.json));
r = await api('POST', '/api/ai', { action: 'breakdown', goalName: '学英语' });
ok('未配置 Key 时拆解返回 503', r.status === 503);
r = await api('POST', '/api/ai', { action: 'plan', tasks: [{ id: 't1', title: '写周报', priority: '高' }] });
ok('未配置 Key 时规划返回 503', r.status === 503);
r = await api('POST', '/api/ai', { action: 'unknown' });
ok('未知操作被拒 400', r.status === 400);

console.log(`\n结果: ${pass} 通过, ${fail} 失败`);
process.exit(fail > 0 ? 1 : 0);