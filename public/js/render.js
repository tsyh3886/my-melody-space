// 渲染层：把 state 渲染到页面，包含所有模态框构建器
import { state, createTask, updateTask, deleteTask, createGoal, updateGoal, deleteGoal, createNote, updateNote, deleteNote, updateNickname, exportBackup, clearAllData, readLegacyLocalData, importLegacy } from './data.js';
import { esc, toast, openModal, closeModal, confirmDel, confirmInput } from './ui.js';
import { PO, todayStr, aiSort, aiReason, aiSug, aiBreakdown, aiSummary, aiGrowth, aiPlan } from './ai.js';

export const editId = { task: null, goal: null, note: null };
export let taskFilter = 'all';
export let noteQ = '';
export function setTaskFilter(v) { taskFilter = v; }
export function setNoteQ(v) { noteQ = v; }

const WMSG = [
  '今天也要温柔地完成自己的小目标哦 🌸',
  '每一个小进步都值得被记录 ✨',
  '慢慢来，比较快 ☁️',
  '今天的美乐蒂也在为你加油呢 🎀',
  '把焦虑交给时间，把行动交给现在 🌟',
  '你比想象中更棒哦 💕',
  '记得给自己留一些休息的时间 🌙',
  '小小的坚持，大大的改变 🌱',
];

function rdmW() { return WMSG[Math.floor(Math.random() * WMSG.length)]; }

export function renderAll() {
  renderHome();
  renderTasks();
  renderGoals();
  renderKnowledge();
}

export function renderPage(p) {
  document.querySelectorAll('.page').forEach((el) => el.classList.remove('active'));
  document.getElementById('page-' + p).classList.add('active');
  document.querySelectorAll('.nav-item').forEach((el) => el.classList.remove('active'));
  const nav = document.querySelector('.nav-item[data-page="' + p + '"]');
  if (nav) nav.classList.add('active');
  if (p === 'home') renderHome();
  else if (p === 'tasks') renderTasks();
  else if (p === 'goals') renderGoals();
  else if (p === 'knowledge') renderKnowledge();
  // assistant 页无动态列表，结果区域在点击按钮时生成，无需重绘
}

export function renderHome() {
  const d = new Date();
  const dy = ['日', '一', '二', '三', '四', '五', '六'];
  document.getElementById('home-date').textContent = d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日 星期' + dy[d.getDay()];
  const un = state.user ? state.user.nickname : '';
  const m = rdmW();
  document.getElementById('welcome-msg').textContent = un ? '欢迎回来，' + un + '！' + m : m;

  const ts = state.tasks, gs = state.goals, ns = state.notes;
  const doneAll = ts.filter((t) => t.status === '已完成');
  document.getElementById('stat-tasks').textContent = doneAll.length;
  document.getElementById('stat-goals').textContent = gs.length;
  document.getElementById('stat-notes').textContent = ns.length;

  const td = todayStr();
  const tt = ts.filter((t) => t.dueDate === td);
  const lblTotal = document.getElementById('lbl-total');
  const lblDone = document.getElementById('lbl-done');
  const lblRate = document.getElementById('lbl-rate');
  if (tt.length === 0) {
    // 没有今日任务：口径切换为「全部任务」，标签同步更新，避免数字与标签语义不一致
    const pend = ts.filter((t) => t.status !== '已完成');
    document.getElementById('today-total').textContent = pend.length;
    document.getElementById('today-done').textContent = doneAll.length;
    const rate = ts.length > 0 ? Math.round((doneAll.length / ts.length) * 100) : 0;
    document.getElementById('today-rate').textContent = rate + '%';
    lblTotal.textContent = '全部待办';
    lblDone.textContent = '已完成';
    lblRate.textContent = '完成率';
  } else {
    const tdone = tt.filter((t) => t.status === '已完成');
    document.getElementById('today-total').textContent = tt.length;
    document.getElementById('today-done').textContent = tdone.length;
    document.getElementById('today-rate').textContent = Math.round((tdone.length / tt.length) * 100) + '%';
    lblTotal.textContent = '今日任务';
    lblDone.textContent = '已完成';
    lblRate.textContent = '完成率';
  }

  if (gs.length > 0) {
    const cg = gs.reduce((a, b) => ((a.progress || 0) < (b.progress || 0) ? a : b));
    document.getElementById('cg-box').style.display = 'block';
    document.getElementById('cg-name').textContent = '当前目标：' + cg.name;
    document.getElementById('cg-prog').style.width = (cg.progress || 0) + '%';
  } else {
    document.getElementById('cg-box').style.display = 'none';
  }
  document.getElementById('ai-sug-text').textContent = aiSug(state.tasks, td);
}

function isOD(s, st) {
  if (!s || st === '已完成') return false;
  return s < todayStr();
}

export function renderTasks() {
  const ts = state.tasks;
  let fl = ts;
  if (taskFilter !== 'all') fl = ts.filter((t) => t.status === taskFilter);
  fl = fl.slice().sort((a, b) => {
    if (a.status === '已完成' && b.status !== '已完成') return 1;
    if (a.status !== '已完成' && b.status === '已完成') return -1;
    return PO[a.priority] - PO[b.priority];
  });
  const el = document.getElementById('task-list');
  if (fl.length === 0) {
    el.innerHTML = '<div class="empty"><div class="empty-text">' + (ts.length === 0 ? '还没有任务哦，点击上方按钮添加第一个任务吧' : '该分类下没有任务') + '</div></div>';
    return;
  }
  let h = '';
  fl.forEach((t) => {
    const pc = t.priority === '高' ? 'ph' : t.priority === '中' ? 'pm' : 'pl';
    const cc = t.category === '工作' ? 'tcw' : t.category === '学习' ? 'tcs' : t.category === '生活' ? 'tcl' : 'tco';
    const sc = t.status === '待完成' ? 'tsp' : t.status === '进行中' ? 'tsd' : 'tsf';
    const pr = t.priority === '高' ? 'tph' : t.priority === '中' ? 'tpm' : 'tpl';
    const od = isOD(t.dueDate, t.status);
    h += '<div class="task-item ' + pc + (t.status === '已完成' ? ' done' : '') + '">';
    h += '<div class="task-header"><div style="display:flex;gap:10px;align-items:flex-start;flex:1"><div class="tcheck' + (t.status === '已完成' ? ' checked' : '') + '" data-toggle="' + t.id + '" role="checkbox" aria-checked="' + (t.status === '已完成') + '" tabindex="0"></div><div class="task-title">' + esc(t.title) + '</div></div><div class="task-actions"><button class="btn btn-secondary btn-sm" data-edit-task="' + t.id + '">编辑</button><button class="btn btn-danger btn-sm" data-del-task="' + t.id + '">删除</button></div></div>';
    h += '<div class="task-meta"><span class="tag ' + cc + '">' + esc(t.category) + '</span><span class="tag ' + pr + '">' + t.priority + '优先级</span><span class="tag ' + sc + '">' + t.status + '</span>';
    if (t.dueDate) h += '<span class="tag tdue' + (od ? ' ov' : '') + '">' + (od ? '已过期 ' : '') + fmtD(t.dueDate) + '</span>';
    h += '</div></div>';
  });
  el.innerHTML = h;
}

function fmtD(s) {
  if (!s) return '无截止日期';
  const d = new Date(s + 'T00:00:00');
  return (d.getMonth() + 1) + '月' + d.getDate() + '日';
}

export function renderGoals() {
  const gs = state.goals;
  const el = document.getElementById('goal-list');
  if (gs.length === 0) {
    el.innerHTML = '<div class="empty"><div class="empty-text">还没有设定目标，点击上方按钮开始你的第一个目标</div></div>';
    return;
  }
  let h = '';
  gs.forEach((g) => {
    h += '<div class="goal-item"><div class="goal-header"><div class="goal-name">' + esc(g.name) + '</div><div style="display:flex;gap:4px"><button class="btn btn-secondary btn-sm" data-edit-goal="' + g.id + '">编辑</button><button class="btn btn-danger btn-sm" data-del-goal="' + g.id + '">删除</button></div></div>';
    if (g.description) h += '<div class="goal-desc">' + esc(g.description) + '</div>';
    h += '<div class="gp-label"><span>进度</span><span>' + (g.progress || 0) + '%</span></div><div class="gp-bar"><div class="gp-fill" style="width:' + (g.progress || 0) + '%"></div></div>';
    if (g.deadline) h += '<div class="goal-deadline">截止：' + fmtD(g.deadline) + '</div>';
    h += '<div class="goal-actions"><button class="btn btn-soft btn-sm" data-prog-goal="' + g.id + '">更新进度</button><button class="btn btn-purple btn-sm" data-bd-goal="' + g.id + '">AI拆解</button></div>';
    h += '<div id="bd-' + g.id + '"></div></div>';
  });
  el.innerHTML = h;
}

export function renderKnowledge() {
  const ns = state.notes;
  let fl = ns;
  if (noteQ) {
    const q = noteQ.toLowerCase();
    fl = ns.filter((n) =>
      (n.title && n.title.toLowerCase().indexOf(q) >= 0) ||
      (n.content && n.content.toLowerCase().indexOf(q) >= 0) ||
      (n.tags && n.tags.toLowerCase().indexOf(q) >= 0)
    );
  }
  const el = document.getElementById('note-list');
  if (fl.length === 0) {
    el.innerHTML = '<div class="empty"><div class="empty-text">' + (ns.length === 0 ? '还没有知识记录，点击上方按钮记录第一个想法' : '没有找到匹配的笔记') + '</div></div>';
    return;
  }
  let h = '';
  fl.forEach((n) => {
    const cc = n.category === '学习' ? 'tcs' : n.category === '灵感' ? 'tph' : n.category === '收藏' ? 'tcl' : 'tco';
    h += '<div class="note-item"><div class="note-title">' + esc(n.title) + '</div>';
    if (n.content) h += '<div class="note-content">' + esc(n.content) + '</div>';
    h += '<div class="note-tags"><span class="tag ' + cc + '">' + esc(n.category) + '</span>';
    if (n.tags) {
      n.tags.split(',').forEach((tg) => { const t = tg.trim(); if (t) h += '<span class="tag tsp">' + esc(t) + '</span>'; });
    }
    h += '</div>';
    h += '<div class="note-actions"><button class="btn btn-secondary btn-sm" data-edit-note="' + n.id + '">编辑</button><button class="btn btn-danger btn-sm" data-del-note="' + n.id + '">删除</button><button class="btn btn-purple btn-sm" data-sum-note="' + n.id + '">Melo整理</button></div>';
    h += '<div id="sum-' + n.id + '"></div></div>';
  });
  el.innerHTML = h;
}

// ===== 任务模态框 =====
export function openTaskModal(id) {
  editId.task = id;
  const t = id ? state.tasks.find((x) => x.id === id) : null;
  const sel = (cond, label) => (cond ? '<option selected>' + label + '</option>' : '<option>' + label + '</option>');
  let body = '<div class="fg"><label class="fl">标题</label><input type="text" class="fi" id="f-task-title" value="' + esc(t ? t.title : '') + '" placeholder="输入任务标题"></div>';
  body += '<div class="fr"><div class="fg"><label class="fl">分类</label><select class="fs" id="f-task-cat">' + sel(t && t.category === '工作', '工作') + sel(t && t.category === '学习', '学习') + sel(t && t.category === '生活', '生活') + sel(!t || t.category === '其他', '其他') + '</select></div>';
  body += '<div class="fg"><label class="fl">截止日期</label><input type="date" class="fi" id="f-task-due" value="' + (t ? t.dueDate || '' : '') + '"></div></div>';
  body += '<div class="fr"><div class="fg"><label class="fl">优先级</label><select class="fs" id="f-task-pri">' + sel(t && t.priority === '高', '高') + sel(!t || t.priority === '中', '中') + sel(t && t.priority === '低', '低') + '</select></div>';
  body += '<div class="fg"><label class="fl">状态</label><select class="fs" id="f-task-st">' + sel(!t || t.status === '待完成', '待完成') + sel(t && t.status === '进行中', '进行中') + sel(t && t.status === '已完成', '已完成') + '</select></div></div>';
  body += '<div class="fa"><button class="btn btn-secondary" data-act="modal-close">取消</button><button class="btn btn-primary" data-act="save-task">保存</button></div>';
  openModal(id ? '编辑任务' : '添加任务', body);
}

export async function saveTask() {
  const title = document.getElementById('f-task-title').value.trim();
  if (!title) { toast('请输入任务标题 🌸'); return; }
  const data = {
    title,
    category: document.getElementById('f-task-cat').value,
    dueDate: document.getElementById('f-task-due').value,
    priority: document.getElementById('f-task-pri').value,
    status: document.getElementById('f-task-st').value,
  };
  try {
    if (editId.task) {
      await updateTask(editId.task, data);
      toast('任务已更新 ✨');
    } else {
      await createTask(data);
      toast('任务已添加 🌸');
    }
    closeModal();
    renderTasks();
    renderHome();
  } catch (e) { toast(e.message); }
}

// ===== 目标模态框 =====
export function openGoalModal(id) {
  editId.goal = id;
  const g = id ? state.goals.find((x) => x.id === id) : null;
  let body = '<div class="fg"><label class="fl">目标名称</label><input type="text" class="fi" id="f-goal-name" value="' + esc(g ? g.name : '') + '" placeholder="如：学习英语"></div>';
  body += '<div class="fg"><label class="fl">描述</label><textarea class="fta" id="f-goal-desc" placeholder="目标描述...">' + esc(g ? g.description || '' : '') + '</textarea></div>';
  body += '<div class="fr"><div class="fg"><label class="fl">截止时间</label><input type="date" class="fi" id="f-goal-dl" value="' + (g ? g.deadline || '' : '') + '"></div>';
  body += '<div class="fg"><label class="fl">进度</label><input type="range" id="f-goal-prog" min="0" max="100" value="' + (g ? g.progress || 0 : 0) + '" oninput="this.nextElementSibling.textContent=this.value+\'%\'"><div class="fl" style="text-align:center;color:var(--pink-d);font-weight:700">' + (g ? g.progress || 0 : 0) + '%</div></div></div>';
  body += '<div class="fa"><button class="btn btn-secondary" data-act="modal-close">取消</button><button class="btn btn-primary" data-act="save-goal">保存</button></div>';
  openModal(id ? '编辑目标' : '添加目标', body);
}

export async function saveGoal() {
  const name = document.getElementById('f-goal-name').value.trim();
  if (!name) { toast('请输入目标名称 🎯'); return; }
  const data = {
    name,
    description: document.getElementById('f-goal-desc').value.trim(),
    deadline: document.getElementById('f-goal-dl').value,
    progress: parseInt(document.getElementById('f-goal-prog').value, 10) || 0,
  };
  try {
    if (editId.goal) {
      await updateGoal(editId.goal, data);
      toast('目标已更新 ✨');
    } else {
      await createGoal(data);
      toast('目标已添加 🎯');
    }
    closeModal();
    renderGoals();
    renderHome();
  } catch (e) { toast(e.message); }
}

// ===== 笔记模态框 =====
export function openNoteModal(id) {
  editId.note = id;
  const n = id ? state.notes.find((x) => x.id === id) : null;
  const sel = (cond, label) => (cond ? '<option selected>' + label + '</option>' : '<option>' + label + '</option>');
  let body = '<div class="fg"><label class="fl">标题</label><input type="text" class="fi" id="f-note-title" value="' + esc(n ? n.title : '') + '" placeholder="笔记标题"></div>';
  body += '<div class="fg"><label class="fl">内容</label><textarea class="fta" id="f-note-content" style="min-height:120px" placeholder="记录你的想法...">' + esc(n ? n.content || '' : '') + '</textarea></div>';
  body += '<div class="fr"><div class="fg"><label class="fl">标签（逗号分隔）</label><input type="text" class="fi" id="f-note-tags" value="' + esc(n ? n.tags || '' : '') + '"></div>';
  body += '<div class="fg"><label class="fl">分类</label><select class="fs" id="f-note-cat">' + sel(n && n.category === '学习', '学习') + sel(n && n.category === '灵感', '灵感') + sel(n && n.category === '收藏', '收藏') + sel(!n || n.category === '其他', '其他') + '</select></div></div>';
  body += '<div class="fa"><button class="btn btn-secondary" data-act="modal-close">取消</button><button class="btn btn-primary" data-act="save-note">保存</button></div>';
  openModal(id ? '编辑笔记' : '添加知识记录', body);
}

export async function saveNote() {
  const title = document.getElementById('f-note-title').value.trim();
  if (!title) { toast('请输入标题'); return; }
  const data = {
    title,
    content: document.getElementById('f-note-content').value.trim(),
    tags: document.getElementById('f-note-tags').value.trim(),
    category: document.getElementById('f-note-cat').value,
  };
  try {
    if (editId.note) {
      await updateNote(editId.note, data);
      toast('笔记已更新 ✨');
    } else {
      await createNote(data);
      toast('知识已记录');
    }
    closeModal();
    renderKnowledge();
    renderHome();
  } catch (e) { toast(e.message); }
}

// ===== Melo 功能 =====
export function showAiSort() {
  const s = aiSort(state.tasks);
  const el = document.getElementById('ai-sort-ctr');
  if (s.length === 0) {
    el.innerHTML = '<div class="asort"><div class="asort-title">推荐任务顺序</div><div style="font-size:13px;color:var(--text-l)">没有待完成的任务，太棒了！🎉</div></div>';
    return;
  }
  let h = '<div class="asort"><div class="asort-title">今日推荐任务顺序</div>';
  s.slice(0, 8).forEach((t, i) => {
    h += '<div class="sort-item"><div class="sort-num">' + (i + 1) + '</div><div class="sort-content"><div class="sort-name">' + esc(t.title) + '</div><div class="sort-reason">' + aiReason(t) + '</div></div></div>';
  });
  h += '</div>';
  el.innerHTML = h;
  toast('已生成推荐顺序');
}

export function showGoalBreakdown(id) {
  const g = state.goals.find((x) => x.id === id);
  if (!g) return;
  const phases = aiBreakdown(g.name);
  const el = document.getElementById('bd-' + id);
  const icons = ['📖', '💪', '✨'];
  let h = '<div class="bd-result">';
  phases.forEach((p, i) => { h += '<div class="bd-phase"><span class="bd-phase-icon">' + (icons[i] || '📌') + '</span><span>' + esc(p) + '</span></div>'; });
  h += '</div>';
  if (el.innerHTML.trim()) el.innerHTML = '';
  else el.innerHTML = h;
}

export function showNoteSummary(id) {
  const n = state.notes.find((x) => x.id === id);
  if (!n) return;
  const r = aiSummary(n.content || '');
  const el = document.getElementById('sum-' + id);
  if (el.innerHTML.trim()) { el.innerHTML = ''; return; }
  let h = '<div class="note-summary"><div class="note-summary-row"><span class="note-summary-label">📝 摘要：</span>' + esc(r.summary) + '</div>';
  if (r.keywords.length > 0) h += '<div class="note-summary-row"><span class="note-summary-label">🏷️ 关键词：</span>' + r.keywords.map(esc).join('、') + '</div>';
  h += '<div class="note-summary-row"><span class="note-summary-label">📂 分类建议：</span>' + r.category + '</div></div>';
  el.innerHTML = h;
  toast('Melo整理完成');
}

export function showAiPlan() {
  const p = aiPlan(state.tasks);
  const el = document.getElementById('ai-plan-result');
  if (p.total === 0) {
    el.innerHTML = '<div class="ai-result" style="white-space:nowrap">没有待完成的任务，今天可以好好休息啦～ 🎀</div>';
    return;
  }
  let h = '<div class="ai-result">';
  if (p.morning.length > 0) {
    h += '<div class="ai-tb"><div class="ai-tl">🌅 上午（高能量时段）</div>';
    p.morning.forEach((t, i) => { h += '<div class="ai-task">' + (i + 1) + '. ' + esc(t.title) + '</div>'; });
    h += '</div>';
  }
  if (p.afternoon.length > 0) {
    h += '<div class="ai-tb"><div class="ai-tl">☀️ 下午（专注时段）</div>';
    p.afternoon.forEach((t, i) => { h += '<div class="ai-task">' + (i + 1) + '. ' + esc(t.title) + '</div>'; });
    h += '</div>';
  }
  if (p.evening.length > 0) {
    h += '<div class="ai-tb"><div class="ai-tl">🌙 晚上（轻松时段）</div>';
    p.evening.forEach((t, i) => { h += '<div class="ai-task">' + (i + 1) + '. ' + esc(t.title) + '</div>'; });
    h += '</div>';
  }
  h += '</div>';
  el.innerHTML = h;
  toast('今日规划已生成 📅');
}

export function showAiTasks() {
  const s = aiSort(state.tasks);
  const el = document.getElementById('ai-tasks-result');
  if (s.length === 0) { el.innerHTML = '<div class="ai-result">所有任务都完成了！🎉</div>'; return; }
  let h = '<div class="ai-result">';
  s.slice(0, 10).forEach((t, i) => {
    h += '<div style="margin-bottom:8px"><strong>' + (i + 1) + '. ' + esc(t.title) + '</strong><br><span style="font-size:12px;color:var(--text-l)">原因：' + aiReason(t) + '</span></div>';
  });
  h += '</div>';
  el.innerHTML = h;
  toast('任务分析完成 🔄');
}

export function showAiSummary() {
  const el = document.getElementById('ai-summary-result');
  el.innerHTML = '<div class="ai-result">' + aiGrowth(state.tasks, state.goals, state.notes) + '</div>';
  toast('成长总结已生成 🌟');
}

// ===== 设置 =====
export function openSettings() {
  const un = state.user ? state.user.nickname : '';
  const legacy = readLegacyLocalData();
  const hasLegacy = legacy && (legacy.tasks.length > 0 || legacy.goals.length > 0 || legacy.notes.length > 0);
  let body = '<div class="fg"><label class="fl">你的昵称</label><input type="text" class="fi" id="f-set-name" value="' + esc(un) + '" placeholder="设置昵称后首页会显示"></div>';
  body += '<div class="srow"><div><div class="slabel">📤 导出备份</div><div class="sdesc">下载当前账号数据的 JSON 文件</div></div><button class="btn btn-primary btn-sm" data-act="export-backup">导出</button></div>';
  body += '<div class="srow"><div><div class="slabel">📥 导入恢复</div><div class="sdesc">从 JSON 文件恢复数据（并入当前账号）</div></div><button class="btn btn-purple btn-sm" data-act="pick-import-file">导入</button></div>';
  if (hasLegacy) {
    body += '<div class="srow"><div><div class="slabel">📦 旧版数据导入</div><div class="sdesc">导入单文件版留在本机的数据（' + (legacy.tasks.length + legacy.goals.length + legacy.notes.length) + ' 条）</div></div><button class="btn btn-green btn-sm" data-act="import-legacy">导入</button></div>';
  }
  body += '<div class="srow"><div><div class="slabel">🗑️ 清空数据</div><div class="sdesc">删除当前账号的所有任务、目标和笔记</div></div><button class="btn btn-danger btn-sm" data-act="clear-data">清空</button></div>';
  body += '<div class="srow"><div><div class="slabel">👋 退出登录</div><div class="sdesc">退出当前账号</div></div><button class="btn btn-secondary btn-sm" data-act="logout">退出</button></div>';
  body += '<div class="fa"><button class="btn btn-primary btn-block" data-act="save-settings">保存设置</button></div>';
  openModal('⚙️ 设置', body);
}

export async function saveSettings() {
  const n = document.getElementById('f-set-name').value.trim();
  if (!n) { toast('昵称不能为空'); return; }
  try {
    await updateNickname(n);
    closeModal();
    renderHome();
    toast('设置已保存 ⚙️');
  } catch (e) { toast(e.message); }
}

export function doExportBackup() {
  try {
    const s = exportBackup();
    const u = 'data:application/json;charset=utf-8,' + encodeURIComponent(s);
    const a = document.createElement('a');
    a.href = u;
    const d = new Date();
    a.download = 'my-melody-backup-' + d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0') + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast('数据已导出 📤');
  } catch { toast('导出失败'); }
}

export async function importLegacyData() {
  const legacy = readLegacyLocalData();
  if (!legacy) { toast('没有找到旧版本地数据'); return; }
  try {
    await importLegacy(legacy);
    closeModal();
    renderAll();
    toast('旧版数据导入成功 📥');
  } catch (e) { toast(e.message); }
}

export async function importJsonFile(file) {
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const payload = {
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
      goals: Array.isArray(parsed.goals) ? parsed.goals : [],
      notes: Array.isArray(parsed.notes) ? parsed.notes : [],
    };
    if (payload.tasks.length === 0 && payload.goals.length === 0 && payload.notes.length === 0) {
      toast('文件格式不正确');
      return;
    }
    await importLegacy(payload);
    closeModal();
    renderAll();
    toast('数据导入成功 📥');
  } catch { toast('导入失败，文件格式错误'); }
}

export async function confirmClearAll() {
  const total = state.tasks.length + state.goals.length + state.notes.length;
  if (total === 0) { toast('当前没有数据可清空'); return; }
  confirmDel('确定要清空当前账号的所有数据吗？此操作不可撤销！', async () => {
    try {
      await clearAllData();
      closeModal();
      renderAll();
      toast('所有数据已清空');
    } catch (e) { toast(e.message); }
  });
}