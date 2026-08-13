# Cloudflare Pages 免费部署指南

本项目的 Cloudflare 版本：前端静态资源由 Pages 托管，API 由 Pages Functions 提供，数据存于 Cloudflare D1（免费 5GB）。

## 一、推送代码到 GitHub

在项目目录执行：

```powershell
cd C:\Users\颜家如\Documents\Codex\my-melody-space
git add -A
git commit -m "feat: 支持 Cloudflare Pages + D1 部署"
git push
```

> 如果 GitHub 直连失败，先临时走代理：`git config --global http.proxy http://127.0.0.1:7890`（推送后 `--unset` 清理）。

## 二、Cloudflare 部署

1. 打开 https://dash.cloudflare.com 注册/登录（免费，无需绑卡）
2. 左侧「Workers 和 Pages」→「创建」→「Pages」→「连接到 Git」
3. 授权 GitHub，选择 `my-melody-space` 仓库
4. 构建配置：
   - 构建命令：`npm install`
   - 输出目录：`public`
5. 点击「保存并部署」，等待构建完成

## 三、创建数据库 D1 并绑定

1. 左侧「D1」→「创建数据库」→ 名称填 `melody` → 创建
2. 回到 Pages 项目 →「设置」→「绑定」→「添加绑定」→ 类型选 **D1 数据库**，变量名填 **`DB`**，选择刚创建的数据库

> 表结构会在第一次请求时自动创建，无需手动建表。

## 四、配置环境变量

Pages 项目 →「设置」→「环境变量」→「生产环境」添加：

| 变量 | 值 |
|---|---|
| `JWT_SECRET` | 一段 64 位随机字符串（可用 `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` 生成） |
| `LLM_API_KEY` | 你的 DeepSeek Key |
| `LLM_BASE_URL` | `https://api.deepseek.com` |
| `LLM_MODEL` | `deepseek-chat` |

保存后重新部署一次（部署菜单 → 重新部署），让配置生效。

## 五、上线

部署完成后，进入 Pages 项目主页，打开 `xxx.pages.dev` 域名即可使用。

## 本地测试

```powershell
npm test
```

使用 node:sqlite 模拟 D1，覆盖注册/登录/任务/目标/笔记/导入/清空/AI 状态等接口。

## 数据迁移（可选）

本地旧数据：打开本地 http://localhost:3000 登录后导出 JSON；线上注册账号后导入即可。
