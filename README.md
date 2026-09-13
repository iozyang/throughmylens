# throughmylens.icu

个人摄影作品馆与摄影资产管理系统。Phase 2 已实现管理员登录、照片资产库、上传前 EXIF 自检、私有原件存储、可控展示图生成、拍摄信息修订和中英文对照编辑。公开首页已提供 SHEPS.LOG 双语设计预览；二级页面仍为占位入口，后台作品编排和发布将在后续阶段接入。首页内容替换、素材来源和验收说明见 [docs/homepage.md](docs/homepage.md)。

## 当前结构

```text
apps/
  api/     FastAPI、认证、数据库迁移、存储适配层
  web/     Next.js 公开站与 /admin 照片管理
scripts/   Windows 本地启动入口
docs/      架构、数据、图片管线与部署说明
```
## 本地启动

1. 仅首次安装且 `.env` 不存在时复制配置：`Copy-Item .env.example .env`。已有配置请保留。
2. 启动基础服务：`docker compose up -d postgres minio minio-init`
3. 首次创建 Python 虚拟环境：`python -m venv apps/api/.venv`。安装或升级依赖：`apps/api/.venv/Scripts/python -m pip install -r apps/api/requirements.txt`。本机需安装 ExifTool，`exiftool -ver` 应能返回版本；如果不在 PATH，请在 `.env` 中设置 `EXIFTOOL_PATH` 为其完整路径。libvips 由 Python 依赖自带。
4. 运行迁移：`apps/api/.venv/Scripts/python -m alembic -c apps/api/alembic.ini upgrade head`
5. 创建管理员：先执行 `Push-Location apps/api`，再执行 `.\.venv\Scripts\python -m app.cli create-admin --email "you@example.com"`；完成后执行 `Pop-Location` 返回项目根目录。
6. 运行 API：`powershell -ExecutionPolicy Bypass -File .\scripts\start-api.ps1`。此选项只作用于本次启动，不修改系统策略。API 内置一个消费持久队列的图片 worker，无需再开终端。
7. 在另一个终端首次安装 Web：`corepack pnpm install`。如果提示 `unrs-resolver` 构建未批准，执行 `corepack pnpm approve-builds` 并只选择该依赖。启动 Web：`corepack pnpm --filter=@throughmylens/web dev`。

本地地址：管理工作区 `http://localhost:3000/admin`，公开站 `http://localhost:3000/zh`，API 文档 `http://localhost:8000/docs`，MinIO Console `http://localhost:9001`。

Web 默认使用 Next.js 标准端口 `3000`（`next dev`），需要临时改端口时可设置 `PORT`。API 仍使用 `8000`；`WEB_ORIGINS` 默认是 `http://localhost:3000`，端口变更时同步配置。修改该配置后需重启 API 才会生效。Windows 动态端口配置已由用户修复，项目不修改系统端口范围。

当前需要同时从电脑和手机联调时，使用 `powershell -ExecutionPolicy Bypass -File .\scripts\dev-mobile.ps1` 作为 Web 启动入口；已有服务运行时无需重复启动。已跑通的 Tailscale / 热点访问方式见 [移动端真机测试](docs/mobile-testing.md)，手机仅测试公开首页。

升级后若 8000 端口无响应，在原 API 终端按 Ctrl+C，然后从项目根目录重新执行第 6 步。不要同时启动多个占用 8000 端口的 API。操作前端时统一使用 `localhost`，避免与 `127.0.0.1` 混用导致 cookie 不共享。

API 启动脚本现在会先验证本地存储，并补建不存在的 `S3_PRIVATE_BUCKET` / `S3_PUBLIC_BUCKET`。新桶默认私有，不改已有桶的数据或访问策略。若存储未就绪则停止启动并显示原因。需要单独初始化时，在 `apps/api` 下运行 `.\.venv\Scripts\python -m app.cli init-storage`；该操作仅允许 development 环境。

## 照片工作流

1. 用已创建的管理员账户登录 `/admin`，点击“添加照片”。
2. 浏览器先检查 JPEG 签名、体积、像素数和拍摄信息，列出缺失字段。默认限制为 30 MB / 60 MP，可在后端 `.env` 调整。
3. 可展开本批次质量设置。默认 Preserve 保持展示大图像素尺寸；Web Standard 可指定长边。两种模式都保留私有原件、不放大、不裁切。
4. 点击上传后，服务端完整解码、验证 sRGB、提取 EXIF 并进行 SHA-256 去重。照片入库为草稿，后台生成缩略图、图库预览和展示大图。
5. 点击照片，在右侧补全元数据，填写中英文标题、描述和替代文本，确认已核对后保存。英文留空时预览回退为对应中文字段。
6. 可在右侧“图片质量与处理结果”查看实际尺寸、字节数和 JPEG 质量，调整参数后重新生成。无法在最低质量内满足体积上限时会明确失败，不会暗中继续降低质量。

原始 GPS、序列号和完整 EXIF 只保存在私有区域。后台照片与展示变体均为草稿私有资源，尚无发布到公开站的功能。首页 Hero、项目与地点仍使用用户指定照片和注明来源的演示素材；精选作品带改由 `selected_work/` 目录的真实照片驱动，先自动读取 EXIF、缺失项再手动补充，详情见 [docs/homepage.md](docs/homepage.md)。Places 仅为轻量预览，完整地图和 Stories 仍安排在 V1.1。

首页精选作品图片准备：`node scripts/prepare-selected-work.mjs`。所有手工信息只在 `apps/web/components/photography/selected-work.json` 填写；已有记录在重新扫描时会保留。完整样例见 [精选作品填写说明](docs/selected-work-editing.md)，填好后运行 `node scripts/validate-selected-work.mjs` 校验。

## 验证命令

```text
corepack pnpm lint:web
corepack pnpm typecheck:web
Push-Location apps/api
.\.venv\Scripts\python -m pytest
.\.venv\Scripts\python -m ruff check app tests scripts alembic
.\.venv\Scripts\python scripts/smoke_photos.py
Pop-Location
```

`smoke_photos.py` 需要 PostgreSQL 和 MinIO 在线，只允许 development 环境；它使用随机命名的临时数据库 schema、临时账户和临时私有 bucket，结束后清理本次创建的内容，不改现有账户或照片。测试覆盖登录、CSRF、上传、去重、处理、元数据编辑、冲突检测和重新处理。

生产部署前必须替换 `.env` 中的本地凭据，并采用真实的 R2 配置。
