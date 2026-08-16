import test from 'node:test';
import assert from 'node:assert/strict';
import { createEnv, dispatch, registerAndGetCookie, readJSON } from './harness.mjs';

const R = {
  register: '../functions/api/auth/register.js',
  login: '../functions/api/auth/login.js',
  logout: '../functions/api/auth/logout.js',
  me: '../functions/api/auth/me.js',
  tasks: '../functions/api/tasks.js',
  taskId: '../functions/api/tasks/[id].js',
  goals: '../functions/api/goals.js',
  goalId: '../functions/api/goals/[id].js',
  notes: '../functions/api/notes.js',
  noteId: '../functions/api/notes/[id].js',
  data: '../functions/api/data.js',
  import: '../functions/api/import.js',
  ai: '../functions/api/ai.js',
  aiStatus: '../functions/api/ai/status.js',
  health: '../functions/api/health.js',
};

test('health 返回 ok', async () => {
  const env = await createEnv();
  const res = await dispatch(env, '/api/health', {}, R.health);
  assert.equal(res.status, 200);
  assert.deepEqual(await readJSON(res), { ok: true });
});

test('注册成功返回 user 并种 cookie', async () => {
  const env = await createEnv();
  const { res, cookie } = await registerAndGetCookie(env, 'alice', 'secret123', '爱丽丝');
  assert.equal(res.status, 201);
  const data = await readJSON(res);
  assert.equal(data.user.username, 'alice');
  assert.equal(data.user.nickname, '爱丽丝');
  assert.ok(cookie && cookie.includes('mms_token='));
});

test('重复注册返回 409', async () => {
  const env = await createEnv();
  await registerAndGetCookie(env, 'alice', 'secret123', '爱丽丝');
  const res = await dispatch(env, '/api/auth/register', { method: 'POST', body: { username: 'alice', password: 'secret123', nickname: '再注册' } }, R.register);
  assert.equal(res.status, 409);
});

test('非法注册参数返回 400', async () => {
  const env = await createEnv();
  const res = await dispatch(env, '/api/auth/register', { method: 'POST', body: { username: 'a', password: '123', nickname: 'x' } }, R.register);
  assert.equal(res.status, 400);
});

test('注册 body 为 null/数组返回 400 而非 500', async () => {
  const env = await createEnv();
  for (const body of [null, ['x']]) {
    const res = await dispatch(env, '/api/auth/register', { method: 'POST', body }, R.register);
    assert.equal(res.status, 400);
    const data = await readJSON(res);
    assert.ok(data.error && data.error.length > 0, '400 响应体应包含错误信息');
  }
});

test('登录成功种 cookie，密码错误 401', async () => {
  const env = await createEnv();
  await registerAndGetCookie(env, 'bob', 'secret123', '鲍勃');
  const ok = await dispatch(env, '/api/auth/login', { method: 'POST', body: { username: 'bob', password: 'secret123' } }, R.login);
  assert.equal(ok.status, 200);
  assert.ok(ok.headers.get('set-cookie').includes('mms_token='));
  const bad = await dispatch(env, '/api/auth/login', { method: 'POST', body: { username: 'bob', password: 'wrong' } }, R.login);
  assert.equal(bad.status, 401);
});

test('未登录访问受保护接口返回 401', async () => {
  const env = await createEnv();
  const res = await dispatch(env, '/api/tasks', {}, R.tasks);
  assert.equal(res.status, 401);
});

test('me 返回当前用户，可修改昵称', async () => {
  const env = await createEnv();
  const { cookie } = await registerAndGetCookie(env, 'carol', 'secret123', '卡罗尔');
  const c = cookie.split(';')[0];
  const me = await dispatch(env, '/api/auth/me', { cookie: c }, R.me);
  assert.equal(me.status, 200);
  assert.equal((await readJSON(me)).user.nickname, '卡罗尔');
  const upd = await dispatch(env, '/api/auth/me', { method: 'PUT', cookie: c, body: { nickname: '新昵称' } }, R.me);
  assert.equal((await readJSON(upd)).user.nickname, '新昵称');
});

test('任务增删改查', async () => {
  const env = await createEnv();
  const { cookie } = await registerAndGetCookie(env, 'dave', 'secret123', '戴夫');
  const c = cookie.split(';')[0];
  const created = await dispatch(env, '/api/tasks', { method: 'POST', cookie: c, body: { title: '写报告', priority: '高' } }, R.tasks);
  assert.equal(created.status, 201);
  const task = await readJSON(created);
  assert.equal(task.title, '写报告');
  assert.equal(task.priority, '高');

  const list = await dispatch(env, '/api/tasks', { cookie: c }, R.tasks);
  assert.equal((await readJSON(list)).length, 1);

  const updated = await dispatch(env, '/api/tasks/' + task.id, { method: 'PUT', cookie: c, body: { status: '已完成' } }, R.taskId, { id: task.id });
  assert.equal((await readJSON(updated)).status, '已完成');

  const del = await dispatch(env, '/api/tasks/' + task.id, { method: 'DELETE', cookie: c }, R.taskId, { id: task.id });
  assert.equal((await readJSON(del)).ok, true);
  const after = await dispatch(env, '/api/tasks', { cookie: c }, R.tasks);
  assert.equal((await readJSON(after)).length, 0);
});

test('任务不能关联不存在的目标', async () => {
  const env = await createEnv();
  const { cookie } = await registerAndGetCookie(env, 'erin', 'secret123', '艾琳');
  const c = cookie.split(';')[0];
  const res = await dispatch(env, '/api/tasks', { method: 'POST', cookie: c, body: { title: 'x', goalId: 'no-such-goal' } }, R.tasks);
  assert.equal(res.status, 400);
});

test('目标进度由子任务自动计算', async () => {
  const env = await createEnv();
  const { cookie } = await registerAndGetCookie(env, 'frank', 'secret123', '弗兰克');
  const c = cookie.split(';')[0];
  const goalRes = await dispatch(env, '/api/goals', { method: 'POST', cookie: c, body: { name: '学会游泳', deadline: '2026-12-31' } }, R.goals);
  const goal = await readJSON(goalRes);
  assert.equal(goal.progress, 0);

  const t1 = await readJSON(await dispatch(env, '/api/tasks', { method: 'POST', cookie: c, body: { title: '子任务1', goalId: goal.id } }, R.tasks));
  const t2 = await readJSON(await dispatch(env, '/api/tasks', { method: 'POST', cookie: c, body: { title: '子任务2', goalId: goal.id } }, R.tasks));
  await dispatch(env, '/api/tasks/' + t1.id, { method: 'PUT', cookie: c, body: { status: '已完成' } }, R.taskId, { id: t1.id });

  const list = await dispatch(env, '/api/goals', { cookie: c }, R.goals);
  const g = (await readJSON(list))[0];
  assert.equal(g.progress, 50);
  assert.equal(g.subtaskCount, 2);
  assert.equal(g.subtaskDone, 1);

  const del = await dispatch(env, '/api/goals/' + goal.id, { method: 'DELETE', cookie: c }, R.goalId, { id: goal.id });
  assert.equal((await readJSON(del)).ok, true);
  assert.equal(t2.id.length > 0, true);
});

test('笔记增删改查', async () => {
  const env = await createEnv();
  const { cookie } = await registerAndGetCookie(env, 'grace', 'secret123', '格蕾丝');
  const c = cookie.split(';')[0];
  const created = await readJSON(await dispatch(env, '/api/notes', { method: 'POST', cookie: c, body: { title: '灵感', content: '内容', tags: 'a,b', category: '灵感' } }, R.notes));
  assert.equal(created.title, '灵感');
  const upd = await readJSON(await dispatch(env, '/api/notes/' + created.id, { method: 'PUT', cookie: c, body: { content: '新内容' } }, R.noteId, { id: created.id }));
  assert.equal(upd.content, '新内容');
  const del = await dispatch(env, '/api/notes/' + created.id, { method: 'DELETE', cookie: c }, R.noteId, { id: created.id });
  assert.equal((await readJSON(del)).ok, true);
});

test('导入旧数据并统计', async () => {
  const env = await createEnv();
  const { cookie } = await registerAndGetCookie(env, 'heidi', 'secret123', '海蒂');
  const c = cookie.split(';')[0];
  const res = await dispatch(env, '/api/import', {
    method: 'POST', cookie: c,
    body: {
      tasks: [{ title: '旧任务', status: '进行中' }],
      goals: [{ name: '旧目标' }],
      notes: [{ title: '旧笔记' }],
    },
  }, R.import);
  assert.equal(res.status, 200);
  const data = await readJSON(res);
  assert.deepEqual(data.imported, { tasks: 1, goals: 1, notes: 1 });
  const tasks = await readJSON(await dispatch(env, '/api/tasks', { cookie: c }, R.tasks));
  assert.equal(tasks[0].status, '待完成'); // 进行中 -> 待完成
});

test('清空当前账号数据', async () => {
  const env = await createEnv();
  const { cookie } = await registerAndGetCookie(env, 'ivan', 'secret123', '伊万');
  const c = cookie.split(';')[0];
  await dispatch(env, '/api/tasks', { method: 'POST', cookie: c, body: { title: 'temp' } }, R.tasks);
  const res = await dispatch(env, '/api/data', { method: 'DELETE', cookie: c }, R.data);
  assert.equal((await readJSON(res)).ok, true);
  const tasks = await readJSON(await dispatch(env, '/api/tasks', { cookie: c }, R.tasks));
  assert.equal(tasks.length, 0);
});

test('AI 状态未配置 key 返回 configured=false', async () => {
  const env = await createEnv();
  const { cookie } = await registerAndGetCookie(env, 'judy', 'secret123', '朱迪');
  const c = cookie.split(';')[0];
  const res = await dispatch(env, '/api/ai/status', { cookie: c }, R.aiStatus);
  assert.equal(res.status, 200);
  assert.equal((await readJSON(res)).configured, false);
});

test('AI 拆解未配置 key 返回 503', async () => {
  const env = await createEnv();
  const { cookie } = await registerAndGetCookie(env, 'kevin', 'secret123', '凯文');
  const c = cookie.split(';')[0];
  const res = await dispatch(env, '/api/ai', { method: 'POST', cookie: c, body: { action: 'breakdown', goalName: '学习' } }, R.ai);
  assert.equal(res.status, 503);
});

test('logout 清除 cookie', async () => {
  const env = await createEnv();
  const { cookie } = await registerAndGetCookie(env, 'leo', 'secret123', '里奥');
  const res = await dispatch(env, '/api/auth/logout', { method: 'POST', cookie: cookie.split(';')[0] }, R.logout);
  assert.equal(res.status, 200);
  assert.ok(res.headers.get('set-cookie').includes('Max-Age=0'));
});
