# 首页本地预览

PC 开发使用 `corepack pnpm --filter=@throughmylens/web dev`，默认端口 3000。电脑打开 <http://localhost:3000/zh> 或 <http://localhost:3000/en>。手机测试时才使用 `scripts/dev-mobile.ps1`，默认监听 `0.0.0.0:3000`，可通过 `-Port` 参数覆盖；已有服务运行时不要重复启动。API 保持 8000，不修改 Windows 端口范围。

## 本轮范围

SHEPS.LOG 首页包含：摄影首屏、连续作品带、精选项目、地点预览、页脚。Work 已有独立双语作品页，详见 [作品页说明](work-page.md)；Projects / Films / Places / About 及示例详情仍是占位入口。没有部署、发布后台私有草稿、修改数据库或扩展后台管理。

内容集中在 `apps/web/components/photography/data.ts`：照片自然尺寸、顺序、桌面/手机焦点、公开元数据、演示来源，以及 heroIds、projects、places。界面文案集中在同目录 `copy.ts`，内容字段使用 `{ zh, en? }`，英文空白逐字段回退中文。后续可接入明确已发布的 CMS 数据。前端管理员原位编辑不在此次首页任务内。

## 精选作品（Selected Work）真实照片

作品带不再使用演示素材，改由 `selected_work/` 目录下的照片驱动。Hero、精选项目与地点预览仍保留演示占位，与作品带相互独立。

所有手动信息集中在一个 JSON，避免来回对照：

1. `scripts/prepare-selected-work.mjs` 扫描原图 EXIF 和地点文字标签，生成最长边 2400px、sRGB、JPEG 92 的衍生图；提取结果备份在 `selected-work.exif.json`。
2. `apps/web/components/photography/selected-work.json` 是唯一手动编辑入口，已填入 30 张照片的现有信息，缺失值显式留空。每项有原文件名，不需要对照 slug 查找。详见 [字段说明及填写样例](selected-work-editing.md)。
3. `selected-work.ts` 仅在服务端读取完整编辑文件，再通过展示字段白名单向首页和作品页传递数据；地点使用 `location.display`。GPS、详细行政区划和 `geocodeQuery` 不进入浏览器数据。`node scripts/validate-selected-work.mjs` 检查新结构、日期、坐标、时区等格式，并列出待补信息。

原始 GPS 坐标不进入公开数据。5 张照片有地点文字标签，25 张地点留空；`2.jpg`、`3.jpg`、`17.jpg`、`42.jpg`、`DSC_0281_169.jpg` 没有可读取的所需拍摄字段，需完整补填。其他部分照片缺日期或参数，以校验脚本逐张输出为准。所有照片的替代文本暂为文件名占位，可自行补充内容描述。

改动图片后重新运行准备脚本可刷新衍生图与 EXIF 基础记录；已有编辑记录原样保留，新照片自动建立完整记录。已有照片的新 EXIF 值需要确认后手工更新，不覆盖人工填写。

## 照片与地图来源

- 首张晚霞为用户指定文件，原件保持不变。展示版本 2400 × 2058、JPEG 92、4:4:4、sRGB，约 1.85 MiB。仅转录已确认的 2026-08-17、f/1.7、ISO 100；未补造地点、焦距或快门。
- Yoshi Takekawa：[Blanca Lake](https://unsplash.com/photos/4qKVQYOluDk)。
- Fabrizio Conti：[Mountain layers](https://unsplash.com/photos/J_3FErYqafI)，没有填入未经确认的地点。
- Red Zeppelin：[Devon coastline](https://unsplash.com/photos/7G-CZTxw10o)。
- Ronan Furuta：[Salt Point](https://unsplash.com/photos/tWzAHnh2Grc)。

上述四张为 [Unsplash License](https://unsplash.com/license) 下的本地演示资产，不是站主作品；信息层、项目题注和页脚注明演示属性。示例项目标题及 2026 年份描述本次编排，并非照片拍摄日期。上线前需要替换/确认，预览页暂设 `noindex, nofollow`。

地图是 [world-atlas 2.0.2 / Natural Earth](https://github.com/topojson/world-atlas) 的简化海岸线，无政治边界；许可随 `apps/web/public/world-atlas-LICENSE.txt` 保留。地点坐标仅为公开地名的近似位置，不来自用户照片 GPS。完整地图/Stories 仍留给后续阶段。

所有展示资源从本地项目提供，访问页面不依赖海外图片 CDN 或地图 API。演示素材准备脚本 `scripts/prepare-homepage-demo.mjs` 只需准备素材时执行，正常启动不下载。`scripts/prepare-homepage-photo.mjs` 生成用户照片的网页衍生图，不覆盖原文件，不复制原始 EXIF/GPS。

## 交互约定

- Hero 每约 7.2 秒切换，1.5 秒叠化，仅维护当前/下一张两个图层；等待下一张解码完成。离开视口、切换后台或暂停时不开始切换。
- Hero 在桌面和手机都仅用于轮播，不提供全屏入口；其图片不接收指针点击、不支持拖出和原生长按图片菜单。精选作品的交互与 Hero 分开。
- Work 约 28 秒移动一屏，三组等宽序列作为循环缓冲，在自动播放、拖动和原生触屏滚动越界时按整组重定位，不等待空闲才循环。鼠标悬停/键盘焦点/拖动暂停，触屏松手后约 1.4 秒恢复。程序滚动不再延长暂停时间。
- PC 信息先显示地点（200ms 延迟）、时间（400ms）、参数（600ms），渐显持续时间保持 180ms；鼠标移出时所有文字及底部衬底同时以 300ms 渐隐，无等待时延。未知参数不编造。后续未特别说明的交互设计以 PC Web 为准，移动端先保留基础可用，深度优化另行进行。
- 桌面点击/键盘 Enter 打开全屏。手机在 pointerup 直接切换信息，不依赖合成 click；信息约 3.5 秒后渐隐，也可再次轻触隐藏。450ms 长按打开；移动超过 8px 或 pointercancel 取消长按，避免滑动误触。首次手机提示通过 localStorage 保存，失败不影响功能。
- 全屏使用原生 dialog、380ms 展开/340ms 返回，支持关闭按钮、Escape、空白区域关闭；关闭恢复滚动和照片焦点。高质量变体按需加载。
- 按 2026-09-12 最新交互要求，两处默认自动播放，不再因系统减少动态偏好自动停播；手动暂停入口始终显示。减少动态偏好仍简化全屏空间动画与装饰位移动效，保留照片及参数的透明度渐变。

## 验证

```text
corepack pnpm lint:web
corepack pnpm typecheck:web
corepack pnpm build:web
corepack pnpm --filter @throughmylens/web test
```

手势与中英文回退采用 Node 内置测试，不增加运行依赖。API 的 `tests/test_web_origin.py` 验证 3000 默认来源和带凭据的 CORS 预检，不启动图片 worker、不修改存储。

2026-09-12 回归修正：暂停/全屏不重建作品带的滚动位置；循环重定位覆盖连续滑动；Strict Mode 的试运行清理不恢复照片焦点；轻触抬手直接响应并抑制后续合成 click，触摸焦点不覆盖参数隐藏状态；Hero 保持纯轮播，解码失败但图片已加载时仍可进入下一轮。现有 17 项单元测试覆盖手势事件顺序、双向各一万次循环几何和双语回退。几何测试不等于实机惯性滚动验收。

本轮浏览器检查覆盖桌面/平板/手机尺寸、语言切换、作品带自然比例、拖动、暂停、循环接缝、全屏键盘与地点预览。浏览器尺寸模拟不等于真机触控测试：手机惯性滚动、450ms 长按和首次提示还需实机复核。修改 `.env` 后，若运行中的 API 尚未重载，需按 README 重启 API。
