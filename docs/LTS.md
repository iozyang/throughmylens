# 照片资产长期维护约定

## 标识与命名

- `Photo.id` 的 UUID 是内部关系和既有图片 URL 的稳定标识，不因改名或编辑 metadata 而改变。
- 对外可读的文件名为 `<YYYYMMDD>-<HHMMSS>-<photo-number>.<ext>`，例如 `20251203-130516-000127.jpg`。`slug` 不含扩展名。
- 优先采用入库时的拍摄日期/时间；只有日期时使用 `000000`，不拼接无关的上传时刻。没有有效日期时使用上传时间（Asia/Shanghai）。命名的兜底时间不反写拍摄 metadata。
- 文件名只生成一次，后续补充或改正时间、地点、标题都不触发重命名。
- `photo_numbers` 的 BIGINT 自增编号至少补齐 6 位。**6 位只用于视觉整齐，不限制 999999 张**：编号 1000000 自然显示为 7 位。不要截断、取模、回收或重新编号。
- 自增序列允许空洞，删除、事务回滚和维护预览均可能消耗编号。编号不是照片总数，也不保证连续。备份/恢复数据库时须包含表和序列状态，避免手动重置到既有最大值以下。

## 旧引用兼容边界

命名迁移只更新数据库中的 file / slug 及版本号；旧值记录在 `PhotoMetadata.sources.previous_filename` 和 `previous_slug`。物理 MinIO key、UUID 图片入口、资产入口都保留，不复制、删除或移动图像数据。

这不是“任意旧 slug 路由自动重定向”的承诺：当前私有图片路由使用 UUID，没有旧 slug 图片路由需要重定向。若未来引入 slug 路由，应以保存的旧值建立显式别名映射。根目录 selected_work、公开静态照片与 selected-work.json 属于独立流程，不随后台命名迁移改写。

## 升级与补全命令

先备份 PostgreSQL 和 MinIO，并在低活动时段操作。以下命令从 `apps/api` 目录运行，使用当前后端环境；不要对已经完成的环境反复导入或重处理。

```powershell
.\.venv\Scripts\python -m alembic upgrade head
.\.venv\Scripts\python -m app.photos.backfill_records
.\.venv\Scripts\python -m app.cli migrate-photo-names
```

最后一条预览待迁移记录并回滚记录修改，但当前实现会申请 PostgreSQL 自增编号，因此**预览仍可消耗序列值**；实际执行的编号可能与预览不同。不要把它当作完全无副作用的数据库读操作。

确认备份和预览范围后，再执行：

```powershell
.\.venv\Scripts\python -m app.cli migrate-photo-names --apply
.\.venv\Scripts\python -m app.cli backfill-previews
```

命名迁移在事务内锁定记录，失败则整批回滚，已分配编号的照片跳过。补充预览按照片提交，只补齐 ready 照片缺少的 micro / preview；中途失败可修复原因后重跑。它不会修复原先 processing_status=failed 的照片，也不会覆盖管理员选择的展示质量。

## 私有缓存与翻译服务

- 私有资产不可配置为公共 CDN 缓存。浏览器私有缓存允许 300 秒复用，具体身份/缓存语义见 [image-pipeline.md](image-pipeline.md)。
- 模型密钥仅保存在后端私有环境配置中，不进入 metadata、前端包、Git 或日志。模型补全必须经过人工保存才入库，不可编造拍摄事实。
- 不将 NVIDIA 模型名称、服务额度或实时可用性视为长期保证；更换服务前需验证响应 schema、超时、空值保护及隐私范围。
- 本地默认 Web 3000、API 8000。环境变动通过配置处理，不硬编码临时 Tunnel 地址，也不修改 Windows 保留端口。
