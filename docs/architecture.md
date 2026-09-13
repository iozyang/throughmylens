# Architecture

## Local V1 boundary

Next.js 负责公开路由和已实现的 `/admin` 界面；FastAPI 拥有认证、管理 API、数据库事务和上传/处理工作流。后续公开页面将使用静态生成与发布驱动的缓存失效；当前尚未实现公开作品发布。

本地环境使用 PostgreSQL/PostGIS 与 MinIO。当前上传由 FastAPI 流式接收并校验后写入 S3；管理预览使用短期签名 GET。浏览器直传和生产部署尚未接入。MinIO 可在后续换为 S3 兼容的 R2，生产性能和大陆访问需另行验证。

## Trust boundary

- `tml-private` 仅保存 Web Master 和中间资产，永不通过公开页面引用。
- `tml-public` 仅保存已发布的、去除敏感 EXIF 的展示变体。
- FastAPI 管理认证使用短生命周期、可撤销的 HttpOnly session cookie；状态变更会要求 CSRF token。
- 前端不持有后台密码、R2 密钥或长期 bearer token。
