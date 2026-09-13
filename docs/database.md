# Database

Phase 1 建立 `users`、`sessions` 与 `failed_login_attempts`。`sessions` 保存不透明 session token 的 SHA-256 哈希而非原始 token；失败登录记录用于数据库级的登录限速。

Phase 2 已通过迁移 `20260910_0002` 增加：

- `photos`：文件身份、唯一 SHA-256、私有原件对象键、输入尺寸、处理配方、处理状态、草稿发布状态与编辑版本号。
- `photo_assets`：缩略图、图库图、展示大图的私有对象键和实际输出参数。
- `photo_metadata`：白名单拍摄信息、每字段 EXIF/manual/missing 来源、审核状态。
- `photo_private_metadata`：不可通过常规照片 API 返回的完整 EXIF 与 GPS 信息。
- `photo_translations`：`photo_id + locale` 联合主键；中文和英文各自保存标题、描述及替代文本。回退只影响显示，不把中文内容复制进英文记录。
- `processing_jobs`：持久处理队列，含配方快照、尝试次数、开始/完成时间和失败信息。

拍摄地点当前为可编辑的公开名称，原始坐标保留私有。PostGIS 已在初始迁移启用，但地图、结构化 locations、Stories 仍属 V1.1。Projects、分类标签、作品编排和发布工作流将在后续 V1 阶段增加。

元数据修改使用行锁和版本号防止多窗口无声覆盖；图片重处理不改变元数据来源或翻译。用户勾选审核时服务端要求品牌、型号、镜头、焦距、光圈、快门、ISO 和地点全部具备。该审核状态与图片处理状态、发布状态独立。
