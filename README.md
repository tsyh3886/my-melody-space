# 美乐蒂数字空间（My Melody Space）🌸

My Melody 治愈风个人数字空间：任务管理、目标管理、知识库与 Melo 助手，前后端全栈、可多端同步的 PWA 应用。

- 前端：原生 HTML + CSS + JavaScript（ES Modules），零框架、零构建工具
- 后端：Node.js（≥24）+ Express 5 + 内置 `node:sqlite`（零原生依赖）
- 鉴权：bcrypt 密码哈希 + JWT（httpOnly Cookie），详见 [ADR-0002](./docs/adr/0002-http-only-cookie-jwt.md)
- 部署形态：Express 同源托管前端静态资源 + REST API，单进程即可运行

## 功能

- **首页（数字房间）**：日期时钟、欢迎语、累计统计、今日状态、当前目标、Melo 建议
- **任务**：CRUD、分类 / 优先级 / 状态 / 截止日期、Melo 智能排序、快捷完成
- **目标**：CRUD、进度（0-100）、截止时间、Melo 三阶段拆解
- **知识库**：CRUD、标签、分类、搜索、Melo 摘要 / 关键词 / 分类建议
- **Melo 助手**：本地规则引擎（不调用外部 AI）：今日规划、任务分析、成长总结
- **账号体系**：注册 / 登录 / 退出，多设备同步（数据在服务器）
- **数据能力**：JSON 备份导出 / 恢复导入、旧版单文件数据一次性迁移、账号数据清空
- **PWA**：manifest + Service Worker（App Shell 缓存、离线提示），可添加到主屏幕
- **无障碍**：可缩放、焦点态、aria 标注、触控目标优化

## 目录结构

```
my-melody-space/
├── CONTEXT.md              # 领域词汇表（项目术语的权威定义）
├── docs/adr/               # 架构决策记录（ADR-0001 ~ 0004）
├── server/                 # 后端
│   ├── src/
│   │   ├── server.js       # Express 入口：静态托管 + 路由 + 错误处理
│   │   ├── db.js           # SQLite（node:sqlite）建库建表
│   │   ├── auth.js         # bcrypt / JWT / Cookie / 鉴权中间件
│   │   ├── validate.js     # 输入校验与归一化
│   │   └── routes/         # auth / tasks / goals / notes / import / data
│   └── test/               # API 冒烟测试 + 前端冒烟测试
└── public/                 # 前端（由 Express 托管）
    ├── index.html
    ├── manifest.webmanifest
    ├── sw.js               # Service Worker
    ├── css/styles.css
    ├── js/                 # ai / data / render / ui / auth / main（ES Modules）
    └── assets/             # 美乐蒂图片与 PWA 图标
```

## 快速开始

要求：Node.js ≥ 24（内置 `node:sqlite`）。

```bash
# 1. 安装依赖
cd server
npm install

# 2. 启动（开发模式自动重启）
npm run dev
# 或：npm start

# 3. 打开
# http://localhost:3000
```

首次启动自动创建 `server/data/melody.db`（SQLite 文件），无需任何配置。

### 运行测试

```bash
cd server
npm test
```

覆盖：注册 / 登录 / 会话、数据隔离、三类实体 CRUD、导入 / 清空、静态资源可达性。

## API 一览

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/auth/register` | 注册（用户名 / 密码 / 昵称），自动登录 |
| POST | `/api/auth/login` | 登录，下发 httpOnly Cookie |
| POST | `/api/auth/logout` | 退出 |
| GET | `/api/auth/me` | 当前用户 |
| PUT | `/api/auth/me` | 修改昵称 |
| GET/POST | `/api/tasks` | 任务列表 / 新建 |
| PUT/DELETE | `/api/tasks/:id` | 更新 / 删除任务 |
| GET/POST | `/api/goals` | 目标列表 / 新建 |
| PUT/DELETE | `/api/goals/:id` | 更新 / 删除目标 |
| GET/POST | `/api/notes` | 笔记列表 / 新建 |
| PUT/DELETE | `/api/notes/:id` | 更新 / 删除笔记 |
| POST | `/api/import` | 一次性导入（旧版数据 / 备份 JSON，并入当前账号） |
| DELETE | `/api/data` | 清空当前账号全部数据 |
| GET | `/api/health` | 健康检查 |

除 `/api/auth/*` 与 `/api/health` 外，均需登录（Cookie `mms_token`）。

## 关键设计

- **服务器为准**：登录后数据以服务器为唯一事实来源，换设备登录即同步（[ADR-0003](./docs/adr/0003-server-authoritative-data.md)）
- **会话安全**：JWT 存 httpOnly + SameSite Cookie，XSS 无法窃取（[ADR-0002](./docs/adr/0002-http-only-cookie-jwt.md)）
- **零外部资源**：无 CDN、无外部字体（系统字体栈），离线只依赖缓存
- **术语统一**：领域词汇见 [CONTEXT.md](./CONTEXT.md)，架构决策见 [docs/adr](./docs/adr/)

## 部署

生产运行：

```bash
NODE_ENV=production JWT_SECRET=<强随机密钥> PORT=3000 npm start
```

- 静态资源由 Express 直接托管，单进程即可
- 数据文件 `server/data/melody.db`（SQLite），注意定期备份
- 建议通过反向代理（如 Nginx / Caddy）提供 HTTPS（Cookie 需 Secure 标志）

## 旧版归档

旧版单文件应用（纯前端、localStorage、完全离线可用）保留在：
`C:\Users\颜家如\WorkBuddy\2026-08-01-17-15-26\my-melody-space.html`。
新版登录后可在「设置 → 旧版数据导入」将旧数据一次性迁入账号。