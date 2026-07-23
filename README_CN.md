# 📋 Clipboard Manager — Windows 剪贴板历史管理工具

一款轻量、高效的 Windows 桌面剪贴板管理工具。后台静默监听剪贴板，自动保存文字和图片复制记录，支持实时搜索、置顶、收藏、批量管理与贴图库，是 Windows 系统剪贴板的强力补充。

[English](README.md)

---

## ✨ 功能

| 模块 | 说明 |
|------|------|
| 🔄 **实时自动记录** | 后台监听剪贴板，窗口打开时新记录会立即同步到列表 |
| 📌 **收藏整理** | 重要条目可置顶或收藏，并可添加文件夹、标签与手动排序 |
| 🔍 **实时搜索** | 模糊匹配文字内容，输即搜，快速定位 |
| 🔗 **链接快捷打开** | 仅包含网址的记录可安全地在默认浏览器中打开 |
| 🖼️ **贴图库** | 导入本地图片存入贴图库，点击一键复制到剪贴板 |
| ☑️ **批量管理** | 批量选择记录，一键删除或清理 |
| 🗑️ **自动清理** | 支持 1 天 / 3 天 / 5 天 / 永久四种存储策略，过期自动清理 |
| 🌙 **精致深色模式** | 统一的浅色 / 深色系统风格，并支持减少动效与减少透明度偏好 |
| 📤 **数据备份** | JSON 格式导出导入，支持数据迁移与恢复 |
| ⌨️ **可配置全局热键** | 可直接在设置中录入新快捷键，默认 `Ctrl+Shift+V` |
| 📊 **存储控制** | 可限制历史条目数和单张图片大小，并查看当前占用 |
| 🎨 **无边框设计** | 圆角半透明窗口，自动吸附鼠标所在屏幕中央 |

---

## 🚀 安装

### 下载安装包

前往 [Releases](https://github.com/adlk-bit/clipboard-manager/releases) 下载最新 `ClipboardManager Setup x.x.x.exe`，双击运行即可。

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

## 🆕 v1.0.2 更新内容

- 窗口打开时自动同步最新剪贴板记录；支持 ↑ / ↓ 浏览记录并按 Enter 复制。
- 收藏支持文件夹、标签、手动排序与按文件夹筛选。
- 纯网址记录可一键在默认浏览器打开，并拒绝非 HTTP(S) 的不安全链接。
- 新增历史条目数和图片大小限制、占用统计，以及对可清理旧记录的自动控制。
- 设置页可直接录入自定义全局快捷键。
- 全面优化浅色/深色视觉系统、交互反馈和无障碍偏好支持。

---

## 🎮 使用指南

| 操作 | 方式 |
|------|------|
| 打开窗口 | `Ctrl+Shift+V` 或双击系统托盘图标 |
| 查看记录 | 左侧导航 →「全部记录」 |
| 复制记录 | 点击卡片右侧 📋 图标，或用 ↑ / ↓ 选中后按 Enter |
| 置顶 | 悬停卡片 → 点击 📌 |
| 收藏 | 悬停卡片 → 点击 ⭐ |
| 整理收藏 | 在「收藏」中通过卡片操作编辑文件夹、标签或调整顺序 |
| 打开链接 | 悬停纯网址记录 → 点击 🔗 |
| 删除 | 悬停卡片 → 点击 🗑️ |
| 批量操作 | 点击列表底部「批量管理」进入多选模式 |
| 搜索 | 顶部搜索框输入关键词 |
| 贴图 | 左侧 →「贴图库」→ 导入 → 点击图片复制 |
| 设置 | 左侧 →「设置」→ 存储期限 / 外观 / 自定义热键 / 存储限制 |
| 备份 | 设置 → 导出 / 导入数据 |

---

## 📁 项目结构

```
clipboard-manager/
├── electron/main/                 # 主进程
│   ├── index.ts                   # 窗口、托盘、热键
│   ├── database.ts                # SQLite 数据库 CRUD
│   ├── clipboard-monitor.ts       # 剪贴板轮询
│   ├── ipc-handlers.ts            # IPC 处理
│   └── scheduler.ts               # 过期清理定时器
├── electron/preload/
│   └── index.ts                   # 安全桥接 API
├── src/                           # 渲染进程 (React)
│   ├── App.tsx
│   ├── components/
│   │   ├── Layout.tsx             # 整体布局
│   │   ├── Sidebar.tsx            # 侧边导航（全部/收藏/贴图/设置）
│   │   ├── HistoryList.tsx        # 历史列表
│   │   ├── HistoryCard.tsx        # 历史卡片（复制/置顶/收藏/删除）
│   │   ├── SearchBar.tsx          # 搜索栏
│   │   ├── StickerGrid.tsx        # 贴图网格
│   │   ├── StickerCard.tsx        # 贴图卡片
│   │   ├── SettingsPanel.tsx      # 设置面板
│   │   ├── ExportImport.tsx       # 导入导出
│   │   ├── ConfirmDialog.tsx      # 确认弹窗
│   │   └── Toast.tsx              # Toast 提示
│   ├── stores/useStore.ts         # Zustand 状态
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
