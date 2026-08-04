// 输入校验与归一化（创建/更新/导入共用）

export const TASK_CATEGORIES = ['工作', '学习', '生活', '其他'];
export const NOTE_CATEGORIES = ['学习', '灵感', '收藏', '其他'];
export const PRIORITIES = ['高', '中', '低'];
export const STATUSES = ['待完成', '进行中', '已完成'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function pickIn(value, list, label) {
  if (!list.includes(value)) return `${label}不合法`;
  return null;
}

export function validateRegister({ username, password, nickname } = {}) {
  if (typeof username !== 'string' || !/^[\u4e00-\u9fa5A-Za-z0-9_]{2,20}$/.test(username.trim())) {
    return '用户名需为 2-20 位中文、字母、数字或下划线';
  }
  if (typeof password !== 'string' || password.length < 6 || password.length > 64) {
    return '密码长度需为 6-64 位';
  }
  if (typeof nickname !== 'string' || nickname.trim().length === 0 || nickname.trim().length > 20) {
    return '昵称需为 1-20 个字符';
  }
  return null;
}

export function normalizeTask(body, { requireTitle = false } = {}) {
  const value = {};
  if (body.title !== undefined) {
    if (typeof body.title !== 'string' || body.title.trim().length === 0 || body.title.trim().length > 100) {
      return { error: '任务标题需为 1-100 个字符' };
    }
    value.title = body.title.trim();
  } else if (requireTitle) {
    return { error: '缺少任务标题' };
  }
  if (body.category !== undefined) {
    const err = pickIn(body.category, TASK_CATEGORIES, '任务分类');
    if (err) return { error: err };
    value.category = body.category;
  }
  if (body.priority !== undefined) {
    const err = pickIn(body.priority, PRIORITIES, '优先级');
    if (err) return { error: err };
    value.priority = body.priority;
  }
  if (body.status !== undefined) {
    const err = pickIn(body.status, STATUSES, '任务状态');
    if (err) return { error: err };
    value.status = body.status;
  }
  if (body.dueDate !== undefined) {
    if (body.dueDate !== '' && !DATE_RE.test(body.dueDate)) return { error: '截止日期格式应为 YYYY-MM-DD' };
    value.dueDate = body.dueDate || null;
  }
  return { value };
}

export function normalizeGoal(body, { requireName = false } = {}) {
  const value = {};
  if (body.name !== undefined) {
    if (typeof body.name !== 'string' || body.name.trim().length === 0 || body.name.trim().length > 100) {
      return { error: '目标名称需为 1-100 个字符' };
    }
    value.name = body.name.trim();
  } else if (requireName) {
    return { error: '缺少目标名称' };
  }
  if (body.description !== undefined) {
    if (typeof body.description !== 'string' || body.description.length > 500) return { error: '目标描述不能超过 500 字' };
    value.description = body.description.trim();
  }
  if (body.deadline !== undefined) {
    if (body.deadline !== '' && !DATE_RE.test(body.deadline)) return { error: '截止时间格式应为 YYYY-MM-DD' };
    value.deadline = body.deadline || null;
  }
  if (body.progress !== undefined) {
    const n = Number(body.progress);
    if (!Number.isInteger(n) || n < 0 || n > 100) return { error: '进度需为 0-100 的整数' };
    value.progress = n;
  }
  return { value };
}

export function normalizeNote(body, { requireTitle = false } = {}) {
  const value = {};
  if (body.title !== undefined) {
    if (typeof body.title !== 'string' || body.title.trim().length === 0 || body.title.trim().length > 100) {
      return { error: '笔记标题需为 1-100 个字符' };
    }
    value.title = body.title.trim();
  } else if (requireTitle) {
    return { error: '缺少笔记标题' };
  }
  if (body.content !== undefined) {
    if (typeof body.content !== 'string' || body.content.length > 5000) return { error: '笔记内容不能超过 5000 字' };
    value.content = body.content.trim();
  }
  if (body.tags !== undefined) {
    if (typeof body.tags !== 'string' || body.tags.length > 100) return { error: '标签不能超过 100 字符' };
    value.tags = body.tags.trim();
  }
  if (body.category !== undefined) {
    const err = pickIn(body.category, NOTE_CATEGORIES, '笔记分类');
    if (err) return { error: err };
    value.category = body.category;
  }
  return { value };
}