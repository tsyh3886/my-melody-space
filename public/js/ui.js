// 通用 UI：toast、模态框、确认/输入弹窗、HTML 转义
export function esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

let toastTimer = null;
export function toast(m) {
  const t = document.getElementById('toast');
  t.textContent = m;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2500);
}

export function openModal(title, bodyHtml) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = bodyHtml;
  document.getElementById('modal-overlay').classList.add('show');
}

export function closeModal() {
  document.getElementById('modal-overlay').classList.remove('show');
}

// 存储待确认回调，由 main.js 的 data-act 委托触发
export let pendingConfirm = null;
export let pendingOk = null;
export let pendingInput = null;

export function confirmDel(msg, cb) {
  pendingConfirm = cb;
  const body = '<div style="text-align:center;padding:10px 0 20px"><div style="font-size:15px;color:var(--text);margin-bottom:20px;line-height:1.6">' + msg + '</div><div class="fa"><button class="btn btn-secondary" data-act="modal-close">取消</button><button class="btn btn-danger" data-act="confirm-del">确定删除</button></div></div>';
  openModal('确认操作', body);
}

// 通用确认弹窗（确定按钮为主色），用于 AI 拆解预览等场景
export function confirmOk(msg, cb, title = '确认操作') {
  pendingOk = cb;
  const body = '<div style="text-align:center;padding:10px 0 20px"><div style="font-size:15px;color:var(--text);margin-bottom:20px;line-height:1.7">' + msg + '</div><div class="fa"><button class="btn btn-secondary" data-act="modal-close">取消</button><button class="btn btn-primary" data-act="confirm-ok">确定</button></div></div>';
  openModal(title, body);
}

export function confirmInput(msg, val, cb) {
  pendingInput = cb;
  const body = '<div style="padding:10px 0 20px"><div style="font-size:15px;color:var(--text);margin-bottom:14px;line-height:1.6">' + msg + '</div><input type="number" class="fi" id="confirm-input-val" value="' + val + '" min="0" max="100" style="margin-bottom:16px"><div class="fa"><button class="btn btn-secondary" data-act="modal-close">取消</button><button class="btn btn-primary" data-act="confirm-input">确定</button></div></div>';
  openModal('更新进度', body);
}