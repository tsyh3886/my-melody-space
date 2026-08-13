// 本地测试 harness：构造 Pages Functions 的 context 并调用中间件 + 路由
import { MockD1 } from './mock-d1.mjs';
import { SCHEMA } from '../functions/api/_middleware.js';

export async function createEnv(overrides = {}) {
  const db = new MockD1(':memory:');
  db.exec(SCHEMA);
  return {
    DB: db,
    JWT_SECRET: 'test-secret-0123456789abcdef',
    ...overrides,
  };
}

export function makeContext(env, pathname, { method = 'GET', body, cookie, params = {} } = {}) {
  const headers = {};
  if (cookie) headers['Cookie'] = cookie;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const request = new Request('https://example.com' + pathname, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return {
    request,
    env,
    params,
    data: {},
    functionPath: pathname,
    next: async () => new Response(null, { status: 404 }),
  };
}

// 走完整链路：中间件（含认证）-> 路由 handler
export async function dispatch(env, pathname, opts, routeModulePath, params = {}) {
  const { onRequest } = await import('../functions/api/_middleware.js');
  const context = makeContext(env, pathname, { ...opts, params });
  const route = await import(routeModulePath);
  const methodMap = { GET: 'Get', POST: 'Post', PUT: 'Put', DELETE: 'Delete' };
  const fnName = 'onRequest' + (methodMap[opts?.method || 'GET'] || '');
  const fn = route[fnName] || route.onRequest;
  if (!fn) throw new Error(`no handler ${fnName} in ${routeModulePath}`);
  context.next = async () => fn(context);
  return onRequest(context);
}

// 注册用户并返回登录 cookie
export async function registerAndGetCookie(env, username, password, nickname) {
  const res = await dispatch(env, '/api/auth/register', { method: 'POST', body: { username, password, nickname } }, '../functions/api/auth/register.js');
  const cookie = res.headers.get('set-cookie');
  return { res, cookie };
}

export async function readJSON(res) {
  return res.json();
}

