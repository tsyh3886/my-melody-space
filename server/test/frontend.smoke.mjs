// 前端冒烟测试：页面与静态资源可达性 + 浏览器登录主流程
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
process.env.PORT = '3101';
process.env.DB_PATH = fileURLToPath(new URL('../data/smoke.db', import.meta.url));
for (const suffix of ['', '-wal', '-shm']) { try { fs.unlinkSync(process.env.DB_PATH + suffix); } catch {} }
const { default: _ } = await import('../src/server.js');

const BASE = 'http://localhost:3101';
let pass = 0, fail = 0;
function ok(name, cond, extra = '') { if (cond) { pass++; console.log('  ✓ ' + name); } else { fail++; console.log('  ✗ ' + name + ' ' + extra); } }

await new Promise((r) => setTimeout(r, 300));

console.log('== 静态资源 ==');
let res = await fetch(BASE + '/');
let html = await res.text();
ok('首页 200', res.status === 200);
ok('首页含登录视图', html.includes('auth-view') && html.includes('美乐蒂数字空间'));
ok('首页含 app 视图', html.includes('page-tasks') && html.includes('page-assistant'));
ok('首页为 ES Module 入口', html.includes('type="module" src="js/main.js"'));
ok('首页无 Google Fonts', !html.includes('fonts.googleapis'));
ok('首页 viewport 允许缩放', /user-scalable=no/.test(html) === false);
ok('首页无重复 apple meta', (html.match(/apple-mobile-web-app-capable/g) || []).length === 1);

res = await fetch(BASE + '/css/styles.css');
let css = await res.text();
ok('styles.css 200', res.status === 200);
ok('CSS 无 base64 内嵌', !css.includes('base64'));
ok('CSS 引用图片文件', css.includes('../assets/img/melody-0.png'));
ok('CSS 含登录视图样式', css.includes('.auth-card'));

for (const js of ['main.js', 'render.js', 'data.js', 'ai.js', 'ui.js', 'auth.js']) {
  res = await fetch(BASE + '/js/' + js);
  ok('js/' + js + ' 200', res.status === 200);
}
res = await fetch(BASE + '/assets/img/melody-0.png');
ok('melody-0.png 200', res.status === 200 && (res.headers.get('content-type') || '').includes('png'));
res = await fetch(BASE + '/assets/icons/icon-192.png');
ok('icon-192.png 200', res.status === 200);
res = await fetch(BASE + '/manifest.webmanifest');
ok('manifest 200', res.status === 200 && (res.headers.get('content-type') || '').includes('json'));
res = await fetch(BASE + '/sw.js');
ok('sw.js 200', res.status === 200);

console.log('== 浏览器主流程 ==');
const jh = { 'Content-Type': 'application/json' };
res = await fetch(BASE + '/api/auth/register', { method: 'POST', headers: jh, body: JSON.stringify({ username: 'demo', password: 'secret123', nickname: '小美' }) });
const cookie = (res.headers.get('set-cookie') || '').split(';')[0];
ok('注册成功', res.status === 201 && !!cookie);
const auth = { 'Content-Type': 'application/json', Cookie: cookie };
res = await fetch(BASE + '/api/tasks', { method: 'POST', headers: auth, body: JSON.stringify({ title: '前端冒烟任务', priority: '高' }) });
ok('创建任务成功', res.status === 201);
res = await fetch(BASE + '/api/import', { method: 'POST', headers: auth, body: JSON.stringify({ tasks: [{ title: '旧数据任务' }], goals: [], notes: [] }) });
ok('导入旧数据成功', res.status === 200);

console.log(`\n结果: ${pass} 通过, ${fail} 失败`);
process.exit(fail > 0 ? 1 : 0);