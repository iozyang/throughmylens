# 移动端真机测试

在手机 / iPad 上访问本地 dev server（端口 3000）。两种方式，推荐 Tailscale（跨网络可用）。

## 方式一：Tailscale 远程访问（推荐，跨网络）

**电脑端（首次配置一次）：**

1. 安装：`winget install tailscale.tailscale`
2. 登录：`tailscale up`，浏览器打开弹出的链接并授权；若没有弹出，则在终端查看给出的 URL再到浏览器打开做相关操作
3. 查虚拟 IP：`tailscale ip -4`（本机为 `100.101.164.68`，固定不变）

**电脑端（每次测试前）：**

4. 启动 dev server：

   ```powershell
   powershell -ExecutionPolicy Bypass -File .\scripts\dev-mobile.ps1
   ```

**移动端（手机 / iPad）：**

5. 打开 Tailscale App，登录**同一账号**，点 Connect
6. 浏览器访问 `http://100.101.164.68:3000/zh`

## 方式二：电脑热点（同一局域网）

**电脑端：**

1. 设置 → 网络和 Internet → 移动热点 → 开启
2. 启动 dev server（命令同上）

**移动端：**

3. 手机 / iPad 连上电脑热点
4. 浏览器访问 `http://192.168.137.1:3000/zh`

## 真机测试清单

| # | 测试项 | 操作 | 预期 |
|---|--------|------|------|
| 1 | Selected Work 惯性滚动 | 横向快速滑动作品带后松手 | 随惯性继续滑动，约 1.4s 后恢复自动移动 |
| 2 | 轻触切换元数据 | 单指轻点照片 | 依次显示地点、时间、参数，再点隐藏；不误触发全屏 |
| 3 | 长按进全屏 | 按住约 450ms | 全屏查看；按压期间有轻微反馈 |
| 4 | 滑动取消长按 | 按住后移动超过 8px | 取消长按、不弹全屏 |
| 5 | 首次提示 | 无痕窗口首次进入 | 底部出现「轻触查看信息 · 长按放大」，约 5s 消失，再次进入不再出现 |
| 6 | Hero 焦点裁剪 | 观察竖屏首屏裁切 | 主体在视觉中心（`focalPosition.mobile`） |
| 7 | 移动导航菜单 | 点「菜单」展开 | 链接与语言切换正常，点击后收起 |
| 8 | 减弱动态 | 系统开启「减弱动态」后刷新 | 仍默认自动播放，可用页面暂停按钮停止；全屏空间动画简化 |
| 9 | 语言切换 | 切 EN / 中 | 文案切换，英文空白字段回退中文 |

## 备注

- `dev-mobile.ps1` 已内置 `-H 0.0.0.0`（监听所有网卡）并尝试放行防火墙；若提示需管理员，手动执行：

  ```powershell
  New-NetFirewallRule -DisplayName "throughmylens-web-dev-3000" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow
  ```

- 只测公开站首页（不依赖 API）；不要用移动端测 `/admin`（依赖 localhost cookie，会失效）。
- 安卓可用 `chrome://inspect` 远程查看 console。
