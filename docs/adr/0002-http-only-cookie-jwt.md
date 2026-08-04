# ADR-0002：会话机制采用 httpOnly Cookie + JWT

- 状态：已接受
- 日期：2026-08-04

## 背景
引入账号体系后需要确定登录态的承载方式。

## 决策
- JWT 写入 httpOnly + SameSite=Lax 的 Cookie，有效期 7 天。
- 不使用 localStorage 存 token，也不使用 Authorization header。
- 生产环境（HTTPS）启用 Secure 标志。

## 理由
- httpOnly 使 XSS 无法读取 token，安全面小。
- 同源部署下 Cookie 自动携带，无 CORS 配置。
- SameSite=Lax 覆盖主要 CSRF 场景。

## 后果
- 未来若前后端分离部署（跨域），需要改造为 Bearer token + CORS。
- 无法被 JS 读取意味着需要依赖浏览器 Cookie 管理，API 调试工具需带 Cookie。