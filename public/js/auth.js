// 鉴权 UI：登录/注册视图、会话初始化、旧版数据导入引导
import { state, checkSession, login, register, logout, fetchAllData, readLegacyLocalData, importLegacy } from './data.js';
import { toast, confirmDel, closeModal } from './ui.js';
import { renderAll } from './render.js';

let authMode = 'login';

export function showAuthView() {
  document.getElementById('app-view').classList.add('hidden');
  document.getElementById('auth-view').classList.remove('hidden');
  setAuthMode('login');
}

export function hideAuthView() {
  document.getElementById('auth-view').classList.add('hidden');
  document.getElementById('app-view').classList.remove('hidden');
}

export function setAuthMode(mode) {
  authMode = mode;
  document.getElementById('auth-view').classList.toggle('show-reg', mode === 'register');
  document.querySelectorAll('.auth-tab').forEach((tab) => {
    const active = tab.dataset.tab === mode;
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-selected', String(active));
  });
  document.getElementById('auth-submit').textContent = mode === 'login' ? '登录' : '注册';
  document.getElementById('auth-err').textContent = '';
}

function setAuthError(msg) {
  document.getElementById('auth-err').textContent = msg || '';
}

export async function handleAuthSubmit() {
  const username = document.getElementById('f-auth-username').value.trim();
  const password = document.getElementById('f-auth-password').value;
  const nickname = document.getElementById('f-auth-nickname').value.trim();
  if (!username || !password) { setAuthError('请输入用户名和密码'); return; }
  const btn = document.getElementById('auth-submit');
  btn.disabled = true;
  btn.textContent = '请稍候...';
  try {
    if (authMode === 'login') await login(username, password);
    else await register(username, password, nickname);
    setAuthError('');
    await initApp();
  } catch (e) {
    setAuthError(e.message);
  } finally {
    btn.disabled = false;
    btn.textContent = authMode === 'login' ? '登录' : '注册';
  }
}

export async function handleLogout() {
  try { await logout(); } catch { /* 忽略网络错误，仍回登录页 */ }
  closeModal(); // 退出按钮在设置弹窗内，先关掉再回登录页
  showAuthView();
  toast('已退出登录 👋');
}

// 应用初始化：拉数据 + 展示 + 引导旧版数据导入
export async function initApp() {
  await fetchAllData();
  closeModal(); // 兜底：避免上一个会话残留弹窗
  hideAuthView();
  renderAll();
  maybePromptLegacyImport();
}

function maybePromptLegacyImport() {
  const legacy = readLegacyLocalData();
  if (!legacy) return;
  const legacyCount = legacy.tasks.length + legacy.goals.length + legacy.notes.length;
  if (legacyCount === 0) return;
  const accountCount = state.tasks.length + state.goals.length + state.notes.length;
  if (accountCount > 0) return; // 账号已有数据，不自动引导
  confirmDel('检测到旧版本地数据（' + legacyCount + ' 条），要一次性导入当前账号吗？', async () => {
    try {
      await importLegacy(legacy);
      await fetchAllData();
      renderAll();
      toast('旧版数据导入成功 📥');
    } catch (e) { toast(e.message); }
  });
}

export async function initAuth() {
  try {
    const user = await checkSession();
    if (user) {
      await initApp();
    } else {
      showAuthView();
    }
  } catch (e) {
    // 网络不可用：无法确认会话
    showAuthView();
    setAuthError(e.message || '无法连接服务器');
  }
}