# Deployment

本项目当前仅针对 localhost 开发。部署时将使用 R2 替换 MinIO，并把开发期 HTTP cookie、密码与访问密钥替换为生产安全配置。

中国大陆用户为主要受众时，公网部署需要单独评估备案、应用托管区域与图片加速方案；不要把本地或海外 CDN 测试结果视作大陆生产性能承诺。

本机目前使用原生 Python API + Docker PostgreSQL/MinIO。可选的全 Docker API 模式已配好 `api` 和 `image-worker` 服务：API 容器禁用内置图片消费者，由独立 worker 运行。镜像安装 ExifTool，libvips 由固定版本的 Python binary 包提供。

API 容器访问存储使用 `http://minio:9000`；`S3_BROWSER_ENDPOINT_URL=http://localhost:9000` 用于生成浏览器能访问且签名正确的私有预览链接。生产时需设置实际可达的 HTTPS 存储端点。Docker 服务尚需在可访问 Docker Engine 的终端完成镜像构建和启动验证。

存储初始化创建的两个桶均默认私有。`minio-init` 任一步失败都会以非零状态退出，API/worker 依赖其成功结束；原生 API 启动脚本也会独立校验并补建缺失桶。公开桶的访客访问策略留待发布流程配置，不在 Phase 2 初始化时开启。
