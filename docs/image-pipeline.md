# Image pipeline

V1 接收 sRGB JPEG Web Master。浏览器用 exifr 在发送文件前检查 EXIF 缺失项，同时检查 JPEG 签名、体积和像素数；服务端仍是权威校验方。

Phase 2 使用有上限的 raw JPEG 流上传到 FastAPI 的临时目录，默认 30 MB / 60 MP。服务端完整解码检查文件、用 ExifTool 提取分组 JSON、验证颜色信息并计算 SHA-256。校验通过后才存入 MinIO 的私有 master 和数据库。此阶段尚未实现浏览器直传 S3；这一传输层简化便于 localhost 调试，后续可替换为短期签名暂存上传，仍需同样的权威校验。

颜色验证优先读取 ICC，使用 LittleCMS 转换采样检查 RGB→标准 sRGB 的偏差，而非信任可改名的 profile 描述。没有 ICC 时，仅接受 EXIF ColorSpace=1，并明确显示“EXIF 声明”；无声明、损坏 ICC、非 RGB 或冲突的标记会被拒绝。采样容差为每通道 3/255，是工程兼容性校验，非 ICC 认证。已接受的 ICC 在生成时转换至标准 sRGB。

默认 `Preserve` 策略保留私有 Web Master，不重采样已处理的作品；前台仅取得适配缩略图、图库、作品页和 Lightbox 的派生变体。`Web Standard` 是后台可选预设：当输入超过明确的展示母版长边时才自动下采样，且永不放大或默认裁切。

具体输出由 libvips 生成：缩略图长边 480、图库预览长边 1440、展示大图长边为输入尺寸（Preserve）或管理员设定值（Web Standard，1280–6000）。所有输出受输入尺寸和展示长边约束，先纠正 EXIF Orientation，再按原比例缩放。Preserve 保持大图像素尺寸，但展示 JPEG 仍会重新编码以清除隐私、控制体积；字节完全不变的原件始终私有保存。

默认目标质量 90、最低质量 80、每个变体体积上限 4096 KB。固定使用 4:4:4 色度抽样、渐进 JPEG 和标准 sRGB ICC。每次以质量步长 2 试编码，最低质量也会尝试；仍超限则失败，不自动降低分辨率或突破质量下限。数据库记录实际宽高、字节数和质量。

处理任务存入 PostgreSQL，API 在本机默认内置一个串行消费者，也可以以 `python -m app.photos.worker` 独立运行。用行锁领取任务，崩溃后超过 15 分钟的运行任务可以重新领取，最多 3 次；尝试序号防止旧消费者覆盖新结果。每次生成使用独立对象路径，所有文件成功后才原子切换资产记录。失败不会影响原件、手动元数据或上一批可用变体。

当前所有原件和变体都存储在 `tml-private`，管理端获取 15 分钟有效的私有预览 URL，不返回 master URL、原始 GPS 或完整 EXIF。生成文件只保留受控 ICC，不嵌入 EXIF、XMP、IPTC、MakerNotes 或序列号。后续发布阶段才会复制审核后的展示变体到 `tml-public`。
