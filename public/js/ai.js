// Melo 本地规则引擎：纯函数，不依赖 DOM，便于测试与复用
export const PO = { 高: 0, 中: 1, 低: 2 };

export function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

export function aiSort(tasks) {
  const pending = tasks.filter((t) => t.status !== '已完成');
  return pending.sort((a, b) => {
    const pd = PO[a.priority] - PO[b.priority];
    if (pd !== 0) return pd;
    if (a.dueDate && b.dueDate) return new Date(a.dueDate + 'T00:00:00') - new Date(b.dueDate + 'T00:00:00');
    if (a.dueDate) return -1;
    if (b.dueDate) return 1;
    return 0;
  });
}

export function aiReason(t, today = todayStr()) {
  const r = [];
  if (t.priority === '高') r.push('优先级高');
  else if (t.priority === '中') r.push('优先级中等');
  if (t.dueDate) {
    const td = new Date(today + 'T00:00:00');
    const du = new Date(t.dueDate + 'T00:00:00');
    const diff = Math.round((du - td) / 86400000);
    if (diff < 0) r.push('已过期' + Math.abs(diff) + '天');
    else if (diff === 0) r.push('今天截止');
    else if (diff <= 2) r.push('截止时间临近');
    else r.push(diff + '天后截止');
  }

  return r.length > 0 ? r.join('，') : '常规处理';
}

export function aiSug(tasks, today = todayStr()) {
  const pend = tasks.filter((t) => t.status !== '已完成');
  const done = tasks.filter((t) => t.status === '已完成');
  const od = tasks.filter((t) => t.status !== '已完成' && t.dueDate && t.dueDate < today);
  if (tasks.length === 0) return '还没有任务呢，去任务页面添加第一个小任务吧～';
  if (od.length > 0) return '有' + od.length + '个任务已过期，建议尽快处理哦 ⏰';
  if (pend.length === 0) return '所有任务都完成了，今天可以好好休息啦～ 🎀';
  const rate = tasks.length > 0 ? Math.round((done.length / tasks.length) * 100) : 0;
  if (rate >= 70) return '今天完成得很好，继续保持！✨';
  if (pend.length > 8) return '未完成任务较多，建议先专注高优先级事项 🎵';
  if (rate >= 40) return '已经有不少进展了，再坚持一下 💪';
  return '今天也要温柔地推进自己的小目标哦';
}

export function aiBreakdown(name) {
  const table = [
    { m: ['英语', '语言', '外语'], p: ['基础学习：掌握词汇和语法基础', '实践练习：每天坚持听说读写训练', '巩固提升：挑战更高难度并实际应用'] },
    { m: ['健身', '运动', '减肥', '跑步'], p: ['建立习惯：每周3次轻度运动', '逐步加强：增加运动强度和时间', '保持节奏：形成稳定运动习惯'] },
    { m: ['摄影', '拍照'], p: ['基础学习：了解相机参数和构图', '实践练习：多拍多看优秀作品', '作品整理：建立个人作品集'] },
    { m: ['编程', '代码', '开发', '程序'], p: ['基础学习：掌握核心语法和概念', '项目实践：动手做小项目', '深入提升：学习框架和最佳实践'] },
    { m: ['读书', '阅读'], p: ['制定计划：列出想读的书单', '坚持阅读：每天固定时间阅读', '输出总结：写读书笔记和感悟'] },
    { m: ['写作', '文章'], p: ['积累素材：建立素材收集习惯', '定期输出：每周写1-2篇文章', '打磨提升：学习技巧并修改'] },
    { m: ['绘画', '画画', '插画'], p: ['基础学习：练习线条和色彩', '实践练习：每天画一幅小作品', '风格形成：探索个人风格'] },
    { m: ['音乐', '吉他', '钢琴', '乐器'], p: ['基础学习：掌握乐理和基本指法', '练习曲目：从简单到复杂', '表演展示：录制作品并分享'] },
  ];
  for (const row of table) {
    for (const kw of row.m) {
      if (name.indexOf(kw) >= 0) return row.p;
    }
  }
  return ['阶段1：基础学习与准备', '阶段2：持续实践与应用', '阶段3：总结反思与提升'];
}

export function aiSummary(text) {
  if (!text || text.trim().length === 0) return { summary: '暂无内容可总结', keywords: [], category: '其他' };
  const sw = ['的', '了', '是', '在', '我', '有', '和', '就', '不', '人', '都', '一个', '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '看', '好', '自己', '这', '那', '它', '他', '她', '什么', '可以', '应该', '需要', '今天', '明天', '昨天', '进行', '通过', '使用', '以及', '或者', '但是', '因为', '所以', '如果', '虽然', '然后'];
  const cw = text.match(/[\u4e00-\u9fa5]{2,4}/g) || [];
  const ew = text.match(/[a-zA-Z]{2,}/g) || [];
  const all = cw.concat(ew);
  const fl = all.filter((w) => sw.indexOf(w.toLowerCase()) < 0);
  const fq = {};
  fl.forEach((w) => { const k = w.toLowerCase(); fq[k] = (fq[k] || 0) + 1; });
  const ks = Object.keys(fq).sort((a, b) => fq[b] - fq[a]).slice(0, 5);
  let sm = text.trim();
  if (sm.length > 80) sm = sm.substring(0, 80) + '...';
  let cat = '其他';
  const cm = [
    { c: '学习', k: ['学习', '课程', '知识', '笔记', '研究', '理解', '掌握', 'study', 'learn', 'read', '教程', '技术'] },
    { c: '灵感', k: ['想法', '灵感', '创意', '如果', '也许', '尝试', 'idea', '设计', '构思'] },
    { c: '收藏', k: ['收藏', '推荐', '资源', '链接', '工具', '书单'] },
  ];
  for (const row of cm) {
    let matched = false;
    for (const k of ks) {
      for (const kw of row.k) {
        if (k.indexOf(kw) >= 0 || kw.indexOf(k) >= 0) { matched = true; break; }
      }
      if (matched) break;
    }
    if (matched) { cat = row.c; break; }
  }
  return { summary: sm, keywords: ks, category: cat };
}

export function aiGrowth(tasks, goals, notes) {
  const ct = tasks.filter((t) => t.status === '已完成');
  let ap = 0;
  if (goals.length > 0) {
    const s = goals.reduce((acc, g) => acc + (g.progress || 0), 0);
    ap = Math.round(s / goals.length);
  }
  let sm = '这一周你完成了 ' + ct.length + ' 个任务，管理着 ' + goals.length + ' 个目标，积累了 ' + notes.length + ' 条知识记录。';
  if (goals.length > 0) sm += '平均目标进度 ' + ap + '%。';
  if (ct.length >= 8) sm += ' 保持不错的成长节奏，继续加油！✨';
  else if (ct.length >= 3) sm += ' 正在稳步前进，每一步都算数 🌸';
  else if (ct.length > 0) sm += ' 刚刚开始，慢慢来就好 🌱';
  else sm += ' 休息也是成长的一部分，准备好了再出发 ☁️';
  return sm;
}

export function aiPlan(tasks) {
  const s = aiSort(tasks).slice(0, 8);
  return {
    morning: s.filter((t) => t.priority === '高'),
    afternoon: s.filter((t) => t.priority === '中'),
    evening: s.filter((t) => t.priority === '低'),
    total: s.length,
  };
}