// 入口：事件绑定、模态框按钮注册表、时钟、离线检测
import { initAuth, handleAuthSubmit, handleLogout, showAuthView, setAuthMode } from './auth.js';
import { state, setUnauthorizedHandler, readLegacyLocalData } from './data.js';
import { toast, closeModal, pendingConfirm, pendingOk, pendingInput } from './ui.js';
import * as render from './render.js';

// 模态框内按钮的统一处理（ES Modules 下内联 onclick 不可用，改用 data-act 注册表）
const ACTIONS = {
  'modal-close': () => closeModal(),
  'confirm-del': () => {
    const cb = pendingConfirm;
    closeModal();
    if (cb) cb();
  },
  'confirm-input': () => {
    const cb = pendingInput;
    const v = document.getElementById('confirm-input-val').value;
    closeModal();
    if (cb) cb(v);
  },
  'confirm-ok': () => {
    const cb = pendingOk;
    closeModal();
    if (cb) cb();
  },
  'save-task': () => render.saveTask(),
  'save-goal': () => render.saveGoal(),
  'save-note': () => render.saveNote(),
  'save-settings': () => render.saveSettings(),
  'export-backup': () => render.doExportBackup(),
  'pick-import-file': () => document.getElementById('import-file').click(),
  'import-legacy': () => render.importLegacyData(),
  'clear-data': () => render.confirmClearAll(),
  'logout': () => handleLogout(),
};

document.addEventListener('click', (e) => {
  const act = e.target.closest('[data-act]');
  if (act && ACTIONS[act.dataset.act]) { ACTIONS[act.dataset.act](act); return; }

  const nav = e.target.closest('.nav-item');
  if (nav) { render.renderPage(nav.dataset.page); return; }

  const ft = e.target.closest('.ftab');
  if (ft) {
    document.querySelectorAll('.ftab').forEach((t) => t.classList.remove('active'));
    ft.classList.add('active');
    render.setTaskFilter(ft.dataset.filter);
    render.renderTasks();
    return;
  }

  const tg = e.target.closest('[data-toggle]');
  if (tg) {
    const t = state.tasks.find((x) => x.id === tg.dataset.toggle);
    if (t) {
      const next = t.status === '已完成' ? '待完成' : '已完成';
      import('./data.js').then(async ({ updateTask }) => {
        try {
          await updateTask(t.id, { status: next });
          render.renderTasks();
          render.renderHome();
          if (next === '已完成') toast('完成啦！🎉');
        } catch (err) { toast(err.message); }
      });
    }
    return;
  }

  const et = e.target.closest('[data-edit-task]');
  if (et) { render.openTaskModal(et.dataset.editTask); return; }

  const dt = e.target.closest('[data-del-task]');
  if (dt) {
    const id = dt.dataset.delTask;
    import('./data.js').then(async ({ deleteTask }) => {
      await deleteTask(id);
      render.renderTasks();
      render.renderHome();
      toast('任务已删除');
    }).catch((err) => toast(err.message));
    return;
  }

  const eg = e.target.closest('[data-edit-goal]');
  if (eg) { render.openGoalModal(eg.dataset.editGoal); return; }

  const dg = e.target.closest('[data-del-goal]');
  if (dg) {
    const id = dg.dataset.delGoal;
    import('./data.js').then(async ({ deleteGoal }) => {
      await deleteGoal(id);
      render.renderGoals();
      render.renderHome();
      toast('目标已删除');
    }).catch((err) => toast(err.message));
    return;
  }


  const bg = e.target.closest('[data-bd-goal]');
  if (bg) { render.showGoalBreakdown(bg.dataset.bdGoal); return; }

  const tgs = e.target.closest('[data-toggle-sub]');
  if (tgs) {
    const t = state.tasks.find((x) => x.id === tgs.dataset.toggleSub);
    if (t) {
      const next = t.status === '已完成' ? '待完成' : '已完成';
      import('./data.js').then(async ({ updateTask }) => {
        try {
          await updateTask(t.id, { status: next });
          render.renderGoals();
          render.renderHome();
          if (next === '已完成') toast('子任务完成');
        } catch (err) { toast(err.message); }
      });
    }
    return;
  }

  const dts = e.target.closest('[data-del-sub]');
  if (dts) {
    const id = dts.dataset.delSub;
    import('./data.js').then(async ({ deleteTask }) => {
      await deleteTask(id);
      render.renderGoals();
      render.renderHome();
      toast('子任务已删除');
    }).catch((err) => toast(err.message));
    return;
  }

  const ats = e.target.closest('[data-add-sub]');
  if (ats) {
    const goalId = ats.dataset.addSub;
    const input = document.getElementById('sub-input-' + goalId);
    const title = input ? input.value.trim() : '';
    if (!title) { toast('先输入子任务内容'); return; }
    import('./data.js').then(async ({ createTask }) => {
      try {
        await createTask({ title, goalId, status: '待完成', priority: '中', category: '其他' });
        render.renderGoals();
        render.renderHome();
        toast('子任务已添加');
      } catch (err) { toast(err.message); }
    });
    return;
  }

  const en = e.target.closest('[data-edit-note]');
  if (en) { render.openNoteModal(en.dataset.editNote); return; }

  const dn = e.target.closest('[data-del-note]');
  if (dn) {
    const id = dn.dataset.delNote;
    import('./data.js').then(async ({ deleteNote }) => {
      await deleteNote(id);
      render.renderKnowledge();
      render.renderHome();
      toast('笔记已删除');
    }).catch((err) => toast(err.message));
    return;
  }

  const sn = e.target.closest('[data-sum-note]');
  if (sn) { render.showNoteSummary(sn.dataset.sumNote); return; }
});



// 会话过期统一回到登录页
setUnauthorizedHandler(() => {
  closeModal();
  showAuthView();
  toast('登录已过期，请重新登录');
});

// 离线状态横幅
function setOfflineUI(offline) {
  document.getElementById('offline-banner').classList.toggle('show', offline);
}
window.addEventListener('online', () => setOfflineUI(false));
window.addEventListener('offline', () => setOfflineUI(true));
setOfflineUI(!navigator.onLine);

// 时钟
function tick() {
  const d = new Date();
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  document.getElementById('home-time').textContent = h + ':' + m;
}

function bind() {
  document.getElementById('btn-settings').addEventListener('click', () => render.openSettings());
  document.getElementById('btn-add-task').addEventListener('click', () => render.openTaskModal(null));
  document.getElementById('btn-add-goal').addEventListener('click', () => render.openGoalModal(null));
  document.getElementById('btn-add-note').addEventListener('click', () => render.openNoteModal(null));
  document.getElementById('btn-ai-sort').addEventListener('click', () => render.showAiSort());
  document.getElementById('btn-ai-plan').addEventListener('click', () => render.showAiPlan());
  document.getElementById('btn-ai-summary').addEventListener('click', () => render.showAiSummary());
  document.getElementById('modal-close-btn').addEventListener('click', () => closeModal());
  document.getElementById('modal-overlay').addEventListener('click', (e) => { if (e.target === e.currentTarget) closeModal(); });
  document.getElementById('note-search').addEventListener('input', (e) => { render.setNoteQ(e.target.value); render.renderKnowledge(); });
  document.getElementById('import-file').addEventListener('change', (e) => {
    if (e.target.files[0]) render.importJsonFile(e.target.files[0]);
    e.target.value = '';
  });
  document.getElementById('auth-submit').addEventListener('click', () => handleAuthSubmit());
  document.getElementById('f-auth-username').addEventListener('keydown', (e) => { if (e.key === 'Enter') handleAuthSubmit(); });
  document.getElementById('f-auth-password').addEventListener('keydown', (e) => { if (e.key === 'Enter') handleAuthSubmit(); });
  document.querySelectorAll('.auth-tab').forEach((tab) => {
    tab.addEventListener('click', () => setAuthMode(tab.dataset.tab));
  });

  tick();
  setInterval(tick, 1000);
  // 注册 Service Worker（PWA 离线壳）
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => { /* 静默失败，不影响使用 */ });
  }
}

bind();
initAuth();