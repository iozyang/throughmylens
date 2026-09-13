# 精选作品信息填写说明（新字段结构）

## 编辑入口与样例

只编辑 `apps/web/components/photography/selected-work.json`。顶层保留 `$schema` 和 `photos` 数组，每个照片对象使用新的字段结构。

完整可校验样例在 [selected-work.example.json](../apps/web/components/photography/selected-work.example.json)，采用你提供的“雪的脉络”示例。它不参与网页展示，不能直接替换全部 30 张照片的数据。

你发来的文本含有 `//` 说明注释，属于 JSONC 风格；正式文件仍是严格 JSON，不允许注释、尾逗号或中文引号。编辑器通过同目录 `selected-work.schema.json` 提示字段和格式。

## 本次迁移

- 30 张照片的文件信息、排序、已填 alt、地点文字、日期、时间和拍摄参数保持不变。
- 旧 `location.zh/en` 原样搬到 `location.display.zh/en`；不猜测拆分 place、district、city、region、country。
- 相机字符串中明确的品牌前缀分离为 brand，其余原文保留在 model；无法判断时 brand 留空，model 保留整个字符串。
- 镜头原文保留在 `lens.model`，brand 不根据机身品牌猜测。
- 新增的作品标题、说明、行政区划、时区、系列、标签和 GPS 信息使用空值，不把样例内容当成现有照片的事实。
- 迁移前完整备份在 `selected_work/selected-work.before-v2.json`。这是备份，不是新的编辑入口。

## 1. 文件与标识

- `slug`：稳定唯一 ID，不随排序或文件名变化而重新编号。
- `file`：原图文件名，用于在 `selected_work` 目录里匹配照片。
- `src`：网页衍生图路径；`width`、`height` 为该衍生图的正整数像素尺寸。
- `order`：非负整数，越小越靠前。
- 不额外保存 orientation 或 aspectRatio，直接从宽高推导。

这几项通常无需修改。原图重命名时同步修改 file，保留 slug 和 src；扫描脚本会复用已登记的标识和访问路径。

## 2. 标题、描述

`title`、`alt`、`description` 都是 `{ "zh": "", "en": "" }`：

- title 是作品名，没命名就留空，不能拿 alt 自动替代。
- alt 客观描述画面，实际用于图片替代文本和无障碍阅读；不要只填文件名。
- description 保存创作背景或 caption，本轮首页、作品页不新增长说明。
- 英文为空时，已展示的字段独立回退中文。title、description 不会自动生成。

## 3. 地点

`location` 保存：

- `place`：具体场所。
- `district`：区、县或类似层级。
- `city`：城市。
- `region`：省、州、自治区等。
- `country`：国家名称。
- `countryCode`：大写两字母代码，如 CN、US、JP；未知使用空字符串。
- `display`：**首页和作品页实际显示的地点文字**。
- `geocodeQuery`：未来地理编码使用的详细文本，本轮不调用地理编码服务。

除 countryCode 外，上述各项都是中英文字段。前台只用 display，不自动拼接行政区划，也不回退展示 geocodeQuery。

例如，只想公开“哈尔滨，中国”，就这样填写 display：

```json
"display": {
  "zh": "哈尔滨，中国",
  "en": "Harbin, China"
}
```

行政层级和定位文本可以比 display 详细。它们只保存在服务端原始目录数据中，不发送给浏览器。已经知道的位置也不要为凑齐层级而猜测。

## 4. GPS 与地图

无坐标时必须完整保留：

```json
"geo": {
  "latitude": "",
  "longitude": "",
  "coordinateSystem": "WGS84",
  "source": "",
  "precision": ""
}
```

坐标必须成对填写，纬度 -90～90、经度 -180～180；不能用 0 代替缺失值。真实位于零经纬线上的数值 0 是有效坐标。

有坐标时，source 选 exif / geocoded / manual；precision 选 exact / approximate / city。coordinateSystem 固定 WGS84，不允许混填 GCJ-02 或 BD-09。

本轮只建立字段与校验，不提取、补算或公开精确 GPS，也不调用第三方服务。未来地图相关工作另行实现。

## 5. 日期和时区

- date：YYYY-MM-DD，例如 `2025-12-03`，未知为 `""`。
- time：HH:mm:ss 或 HH:mm，例如 `13:05:16`，未知为 `""`。
- timezone：IANA 时区，如 `Asia/Shanghai`、`America/New_York`，未知为 `""`。
- 保留拍摄时钟值，填写 timezone 不会改变网页显示的日期或时间。

## 6. 相机与镜头

camera 和 lens 都是对象：

```json
"camera": { "brand": "DJI", "model": "FC8482" },
"lens": { "brand": "", "model": "24.0 mm f/1.7" }
```

这两项用于完整器材资料，不显示在首页和作品页参数行。镜头型号不等于这次曝光所用的焦距和光圈。

## 7. 拍摄参数

- focalLength：实际焦距，如 `6.72mm`。
- focalLength35mm：单独记录等效焦距，如 `24mm`；只在实际焦距为空时用于展示，并标记“等效”。
- aperture：如 `f/1.7`、`f/8`。
- shutterSpeed：如 `1/2500s`、`0.5s`、`30s`。
- iso：正整数，不加引号；未知为 `""`。其他参数未知也为 `""`。

参数之间不使用“·”，各组保留约 0.8em 的留白；不要通过在 JSON 中输入多个空格控制间距。

## 8. 系列与标签

无系列时 `series: { "slug": "", "zh": "", "en": "" }`；有系列时：

```json
"series": { "slug": "harbin-winter", "zh": "哈尔滨之冬", "en": "Harbin in Winter" },
"tags": ["winter", "snow", "railway"]
```

tags 无内容用 `""`；有内容可填中文或英文标签数组，例如 `["风光", "冬季"]`，不要重复。系列 slug 使用英文、数字、连字符或下划线。静态目录的这些字段仅保存与校验，不自动生成项目、地图、搜索或筛选；后台上传相册另见 [照片资产管理](photo-asset-management.md)。

## 保存、校验与重新扫描

在项目根目录运行：

```powershell
node scripts/validate-selected-work.mjs
```

格式错误会指出文件名、字段及原因；空白待补信息只提示，不算失败。保存后，首页及作品页会读取新的 display 和参数。

新增照片运行 `node scripts/prepare-selected-work.mjs`：新记录按新结构创建，已有记录（包括你有意留空的值）保持不变。扫描可读取来源明确的地点标签和器材字段，但不会根据文字猜行政区划、时区或坐标。

历史 selected-work.exif.json 是可重新生成的提取记录；selected-work.overrides.json 只作旧资料兼容，都不再是编辑入口。原图不修改，网页衍生图仍去除 EXIF/GPS。

页面仅接收必要展示字段；详细地点、GPS、器材、系列、标签等原始资料不会随公开页发给浏览器。当前仍是 localhost 开发，请勿把原始目录 JSON 直接复制到 public 文件夹。

动画保持不变：地点、时间、参数依次渐显（200/400/600ms），移开全部同步 300ms 渐隐。
