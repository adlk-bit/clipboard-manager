# 📋 Clipboard Manager — Windows 剪贴板历史管理工具

一款轻量、高效的 Windows 桌面剪贴板管理工具。后台静默监听剪贴板，自动保存文字和图片复制记录，支持实时搜索、编辑后复制、Emoji、置顶、收藏、批量管理与贴图库，是 Windows 系统剪贴板的强力补充。

[English](README.md)

---

## ✨ 功能

| 模块 | 说明 |
|------|------|
| 🔄 **实时自动记录** | 后台监听剪贴板，窗口打开时新记录会立即同步到列表 |
| ⏸️ **隐私暂停** | 可从历史工具栏或托盘暂停/恢复记录；状态会跨重启保留，暂停期间复制的内容恢复后也不会补录 |
| ♻️ **智能去重** | 相同文字和图片自动合并，记录累计使用次数与最近使用时间，让历史更精简 |
| 🔥 **常用优先** | 可在最新与常用记录之间切换，更快找到高频内容 |
| 📌 **收藏整理** | 重要条目可置顶或收藏，并可添加文件夹、标签与手动排序 |
| 🔍 **实时搜索** | 模糊匹配文字内容，输即搜，快速定位 |
| 🔗 **链接快捷打开** | 仅包含网址的记录可安全地在默认浏览器中打开 |
| ✏️ **编辑后复制** | 在专用编辑框中修改文字记录并复制新内容，不覆盖原始历史记录 |
| 😀 **Emoji 选择器** | 内置 7 类 233 个 Emoji，支持中英文搜索与最近使用，可一键复制 |
| 🖼️ **贴图库** | 导入本地图片存入贴图库，点击一键复制到剪贴板 |
| 📱 **手机共享** | iPhone 与 Android 均可在同一局域网扫码配对、与 Windows 双向发送文字，并管理已连接设备 |
| 🔢 **验证码转发** | iPhone 使用“信息”快捷指令；Android 使用显式授权的通知访问，只转发六位数字且不保留到历史记录 |
| ☑️ **批量管理** | 多选记录后批量删除 |
| 🗑️ **自动清理** | 支持 1 天 / 3 天 / 5 天 / 永久，按最近使用时间判断过期并同步清理图片文件 |
| 🌙 **紧凑系统界面** | 节省空间的浅色 / 深色界面，统一 SVG 图标、清晰主操作，并支持减少动效偏好 |
| 📤 **完整便携备份** | `.clipbackup` 包含文字、图片、贴图库、收藏元数据和安全设置，支持合并/覆盖恢复及旧版 JSON 导入 |
| 🛡️ **本地数据保护** | 数据库原子快照、启动完整性修复、受限本地资源访问、CSP 与沙箱渲染 |
| ⌨️ **可配置全局热键** | 可直接在设置中录入新快捷键，默认 `Ctrl+Shift+V` |
| 📊 **存储控制** | 可限制历史条目数和单张图片大小，并查看当前占用 |
| 🪟 **原生窗口控制** | 无边框系统风格标题栏，支持最小化、最大化/还原与关闭到托盘 |

---

## 🚀 安装

### 下载安装包

前往 [Releases](https://github.com/adlk-bit/clipboard-manager/releases) 下载：

- Windows：`ClipboardManager-Setup-1.1.0.exe`，双击运行安装。
- Android：`ClipboardManager-Android-1.1.0.apk`，允许浏览器或文件管理器“安装未知应用”后安装。

### 从源码运行

```bash
# 克隆仓库
git clone https://github.com/adlk-bit/clipboard-manager.git
cd clipboard-manager

# 安装依赖
npm install

# 开发模式（热重载）
npm run dev

# 生产构建 & 打包
npm run dist
```

> **环境要求：** Node.js ≥ 18 · npm ≥ 9 · Windows 10/11

---

## 📱 手机共享剪贴板与验证码

1. 确保电脑与手机连接同一个可信 Wi-Fi，电脑应用保持运行（可缩小到托盘）。
2. 打开左侧「连接设备」，选择正确的电脑网络，点击「生成配对二维码」。若 Windows 防火墙首次询问，只允许“专用网络”。
3. **iPhone：** 用相机扫码，在 Safari 页面确认连接。验证码按页面说明创建「收到信息时」个人自动化，用“匹配文本”提取六位数字并设为“立即运行”。
4. **Android：** 安装配套 APK，用相机扫码后选择「用 Android 应用连接」。应用前台可双向同步文字；如需验证码转发，在应用内显式开启系统“通知访问”。
5. 在电脑「已连接设备」中可查看平台/在线状态、单独关闭验证码接收或撤销设备；手机端也可主动断开。

> **iOS 限制：** 第三方应用和网页不能直接读取 iPhone 短信。本项目使用 Apple 系统「快捷指令」的“信息”触发器，只有用户明确配置的自动化会转发匹配到的六位数字。

> **Android 权限：** 配套应用不申请 `READ_SMS`/`RECEIVE_SMS`。通知访问必须由用户在系统设置中明确授予；应用只检查消息类通知，要求验证码上下文且仅有一个六位数字时才转发，不保存或发送完整通知。Android 10 以后后台应用不能任意读取剪贴板，因此普通剪贴板同步只在应用前台、由用户点击触发。

> **网络安全：** 同步不经过云端；一次性二维码 5 分钟后失效，Android 长期凭据由 Android Keystore 加密保存，电脑只保存设备密钥哈希。当前局域网传输为 HTTP，请只在可信的家庭或个人网络使用，不要在公共 Wi-Fi 传输敏感内容。如果电脑 IP 发生变化，需要重新扫码。

Android 源码、构建方式和隐私设计见 [android/README_CN.md](android/README_CN.md)。

---

## 🆕 v1.1.0 更新内容

- 左侧栏新增「连接设备」模块，可选择电脑局域网地址、生成 5 分钟有效的配对二维码，并查看、控制或撤销已连接的 iPhone 与 Android 设备。
- 新增手机与 Windows 双向文字传输：iPhone 使用扫码网页，Android 使用开源 Kotlin 配套应用；普通剪贴板传输由手机端明确操作触发。
- 新增六位验证码转发：iPhone 可配合「信息」个人自动化，Android 可在用户授予通知访问后从消息通知中提取并转发唯一验证码。
- Android 配套应用提供深链配对、Android Keystore 凭据加密、验证码去重、通知来源/语义过滤以及手机端主动断开功能。
- 手机服务仅监听局域网私有地址，二维码令牌一次性使用；电脑仅保存设备密钥哈希，并可按设备关闭验证码或撤销授权。
- 新增 MIT 许可证、Android 中英文构建/隐私文档，以及桌面协议、配对安全、验证码过滤和 Android URL 校验测试。

---

## 🎮 使用指南

| 操作 | 方式 |
|------|------|
| 打开窗口 | `Ctrl+Shift+V` 或双击系统托盘图标 |
| 查看记录 | 左侧导航 →「全部记录」 |
| 复制记录 | 点击卡片右侧 📋 图标，或用 ↑ / ↓ 选中后按 Enter |
| 编辑后复制 | 点击复制按钮旁的铅笔图标，修改文字后点击「复制修改内容」或按 `Ctrl+Enter` |
| 切换历史排序 | 在「全部记录」中选择「最新」或「常用」 |
| 暂停/恢复记录 | 在「全部记录」点击「暂停记录」，或使用托盘菜单 |
| 置顶 | 悬停卡片 → 点击 📌 |
| 收藏 | 悬停卡片 → 点击 ⭐ |
| 整理收藏 | 在「收藏」中通过卡片操作编辑文件夹、标签或调整顺序 |
| 打开链接 | 悬停纯网址记录 → 点击 🔗 |
| 删除 | 悬停卡片 → 点击 🗑️ |
| 批量操作 | 点击列表底部「批量管理」进入多选模式 |
| 搜索 | 顶部搜索框输入关键词 |
| Emoji | 左侧 →「Emoji」→ 选择分类或搜索 → 点击 Emoji 复制 |
| 贴图 | 左侧 →「贴图库」→ 导入 → 点击图片复制 |
| 连接手机 | 左侧 →「连接设备」→ 生成二维码 → 用手机相机扫描 |
| Android 验证码 | Android 配套应用 → 开启转发 → 在系统设置授予通知访问 |
| iPhone 验证码 | 配对后的 iPhone 页面 → 按说明创建“信息”个人自动化 |
| 撤销手机 | 左侧 →「连接设备」→ 已连接设备 → 🗑️ |
| 设置 | 左侧 →「设置」→ 存储期限 / 外观 / 自定义热键 / 存储限制 |
| 备份 | 设置 →「完整备份 / 恢复备份」，然后选择合并或覆盖 |

---

## 📁 项目结构

```
clipboard-manager/
├── electron/main/                 # 主进程
│   ├── index.ts                   # 窗口、托盘、热键
│   ├── database.ts                # SQLite 数据库 CRUD
│   ├── clipboard-monitor.ts       # 剪贴板轮询
│   ├── ipc-handlers.ts            # IPC 处理
│   ├── mobile-sync.ts             # 手机局域网配对、鉴权与同步服务
│   ├── mobile-page.ts             # 手机扫码网页、Android 深链与 iOS 快捷指引
│   ├── backup.ts                  # 便携备份归档与校验
│   ├── asset-paths.ts             # 本地资源访问边界
│   └── scheduler.ts               # 过期清理定时器
├── electron/preload/
│   └── index.ts                   # 安全桥接 API
├── src/                           # 渲染进程 (React)
│   ├── App.tsx
│   ├── components/
│   │   ├── Layout.tsx             # 整体布局
│   │   ├── Sidebar.tsx            # 侧边导航（全部/收藏/Emoji/贴图/设备/设置）
│   │   ├── HistoryList.tsx        # 历史列表
│   │   ├── HistoryCard.tsx        # 历史卡片（编辑/复制/置顶/收藏/删除）
│   │   ├── EditCopyDialog.tsx     # 编辑后复制弹窗
│   │   ├── EmojiPicker.tsx        # 可搜索分类 Emoji 选择器
│   │   ├── DevicesPanel.tsx       # 二维码配对与已连接设备管理
│   │   ├── Icon.tsx               # 统一 SVG 图标集
│   │   ├── SearchBar.tsx          # 搜索栏
│   │   ├── StickerGrid.tsx        # 贴图网格
│   │   ├── StickerCard.tsx        # 贴图卡片
│   │   ├── SettingsPanel.tsx      # 设置面板
│   │   ├── ExportImport.tsx       # 导入导出
│   │   ├── ConfirmDialog.tsx      # 确认弹窗
│   │   └── Toast.tsx              # Toast 提示
│   ├── stores/useStore.ts         # Zustand 状态
│   ├── data/emojis.ts             # 内置 Emoji 与搜索关键词
│   ├── types/index.ts             # 类型定义
│   └── styles/index.css           # Tailwind + 全局样式
├── resources/                     # 静态资源
│   ├── icon.png                   # 应用图标 (256×256)
│   ├── icon.ico                   # Windows 图标
│   └── tray-icon.png              # 托盘图标 (16×16)
├── android/                       # 开源 Android 配套应用（Kotlin）
│   ├── app/src/main/              # 深链配对、剪贴板与通知验证码实现
│   ├── app/src/test/              # 私网地址与验证码提取测试
│   └── README_CN.md               # Android 构建、安装和隐私说明
├── electron.vite.config.ts
├── electron-builder.yml
├── tailwind.config.js
└── package.json
```

---

## 🛠️ 技术栈

| 层 | 技术 |
|---|------|
| 框架 | Electron 43 |
| UI | React 18 + TypeScript |
| 构建 | Vite 5 + electron-vite 3 |
| 样式 | Tailwind CSS 3 |
| 状态 | Zustand 5 |
| 数据库 | sql.js (SQLite WASM) |
| 打包 | electron-builder (NSIS) |

---

## 📦 自定义打包

编辑 `electron-builder.yml`：

```yaml
appId: com.clipboard.manager
productName: ClipboardManager
win:
  target: [nsis]
  icon: resources/icon.ico
nsis:
  oneClick: false
  allowToChangeInstallationDirectory: true
  createDesktopShortcut: true
```

---

## 📄 License

MIT
