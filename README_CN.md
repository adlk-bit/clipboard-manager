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

前往 [Releases](https://github.com/adlk-bit/clipboard-manager/releases) 下载 `ClipboardManager-Setup-1.0.6.exe`，双击运行即可。

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

## 🆕 v1.0.6 更新内容

- 左侧栏新增 Emoji 页面，内置 7 类 233 个 Emoji，支持中文/英文关键词搜索和本地最近使用列表。
- 文字卡片的复制按钮旁新增常驻编辑按钮；编辑框支持最多 10,000 字符、`Ctrl+Enter` 快速复制和 `Esc` 关闭，同时保留原始历史记录。
- 新增的剪贴板 IPC 在主进程执行长度、控制字符校验和写入结果回读验证。
- 窗口调整为更紧凑的系统风格：缩窄标题栏与侧栏、压缩卡片和控件间距，并统一使用可复用 SVG 图标。
- 编辑与复制作为主操作始终可见，置顶、收藏、删除等次级操作仍可通过悬停或键盘焦点访问。
- 扩展 Electron 运行时冒烟测试，覆盖 Emoji 导航以及非法 Emoji、非法编辑文本的拒绝逻辑。

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
│   ├── backup.ts                  # 便携备份归档与校验
│   ├── asset-paths.ts             # 本地资源访问边界
│   └── scheduler.ts               # 过期清理定时器
├── electron/preload/
│   └── index.ts                   # 安全桥接 API
├── src/                           # 渲染进程 (React)
│   ├── App.tsx
│   ├── components/
│   │   ├── Layout.tsx             # 整体布局
│   │   ├── Sidebar.tsx            # 侧边导航（全部/收藏/Emoji/贴图/设置）
│   │   ├── HistoryList.tsx        # 历史列表
│   │   ├── HistoryCard.tsx        # 历史卡片（编辑/复制/置顶/收藏/删除）
│   │   ├── EditCopyDialog.tsx     # 编辑后复制弹窗
│   │   ├── EmojiPicker.tsx        # 可搜索分类 Emoji 选择器
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
