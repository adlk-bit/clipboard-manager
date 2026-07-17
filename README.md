# 📋 Clipboard Manager — Windows 剪贴板历史管理工具

一款简洁实用的 Windows 桌面剪贴板管理工具，自动记录复制内容（文字 & 图片），支持搜索、置顶、收藏，以及贴图库功能。

---

## ✨ 功能特性

| 功能 | 说明 |
|------|------|
| 🔄 **自动记录** | 后台监听剪贴板，自动保存所有复制的文字和图片 |
| 📌 **置顶 & 收藏** | 重要记录可置顶/收藏，不受过期清理影响 |
| 🔍 **实时搜索** | 模糊匹配文字内容，快速定位历史记录 |
| 🕐 **存储期限** | 支持 1天 / 3天 / 5天 / 永久，过期自动清理 |
| 🖼️ **贴图库** | 导入本地图片作为贴图库，一键发送到剪贴板 |
| 📤📥 **导出/导入** | JSON 格式备份和恢复历史数据 |
| ⌨️ **全局热键** | `Ctrl+Shift+V` 唤起窗口，随时查看历史 |
| 🎨 **简洁 UI** | 淡蓝色主题，无边框圆角设计，卡片式布局 |

---

## 🚀 快速开始

### 环境要求

- Node.js >= 18
- npm >= 9
- Windows 10/11

### 安装 & 运行

```bash
# 克隆仓库
git clone <your-repo-url>
cd clipboard-manager

# 安装依赖
npm install

# 开发模式（热重载）
npm run dev

# 生产构建
npm run build

# 启动
npm start
```

### 打包 Windows 安装包

```bash
npm run dist
```

生成的安装包位于 `dist/` 目录下。

---

## 📁 项目结构

```
clipboard-manager/
├── electron/main/              # Electron 主进程
│   ├── index.ts                # 窗口/托盘/热键管理
│   ├── database.ts             # SQLite 数据库 CRUD
│   ├── clipboard-monitor.ts    # 剪贴板轮询监听
│   ├── ipc-handlers.ts         # IPC 通信处理
│   └── scheduler.ts            # 定时清理过期记录
├── electron/preload/           # 预加载脚本
│   └── index.ts                # 安全桥接 API
├── src/                        # React 渲染进程
│   ├── App.tsx                 # 主应用组件
│   ├── components/             # UI 组件
│   │   ├── Layout.tsx          # 整体布局
│   │   ├── Sidebar.tsx         # 侧边导航
│   │   ├── HistoryList.tsx     # 历史记录列表
│   │   ├── HistoryCard.tsx     # 历史记录卡片
│   │   ├── SearchBar.tsx       # 搜索栏
│   │   ├── StickerGrid.tsx     # 贴图网格
│   │   ├── StickerCard.tsx     # 贴图卡片
│   │   ├── SettingsPanel.tsx   # 设置面板
│   │   ├── ExportImport.tsx    # 导出导入
│   │   ├── ConfirmDialog.tsx   # 确认弹窗
│   │   └── Toast.tsx           # Toast 提示
│   ├── stores/useStore.ts      # Zustand 状态管理
│   ├── types/index.ts          # TypeScript 类型定义
│   └── styles/index.css        # Tailwind + 全局样式
├── resources/                  # 静态资源
│   ├── icon.png                # 应用图标
│   └── tray-icon.png           # 托盘图标
├── index.html                  # 入口 HTML
├── electron.vite.config.ts     # Vite 构建配置
├── electron-builder.yml        # 打包配置
├── tailwind.config.js          # Tailwind 配置
└── package.json
```

---

## 🛠️ 技术栈

| 层 | 技术 | 说明 |
|---|------|------|
| 框架 | Electron 43 | 跨平台桌面应用框架 |
| 前端 | React 18 + TypeScript | UI 层 |
| 构建 | Vite 5 + electron-vite 3 | 快速开发构建 |
| 样式 | Tailwind CSS 3 | 原子化 CSS |
| 状态管理 | Zustand 5 | 轻量级状态管理 |
| 数据库 | sql.js | 纯 JavaScript SQLite 实现 |
| 打包 | electron-builder | Windows 安装包生成 |

---

## 🎮 使用指南

### 基本操作

1. 启动后程序会在**系统托盘**常驻运行
2. 按下 `Ctrl+Shift+V` 或**双击托盘图标**打开主窗口
3. 正常复制文字或图片，程序自动记录

### 历史记录

- **复制**：点击卡片右侧 📋 图标，将内容重新复制到剪贴板
- **置顶**：悬停卡片，点击 📌 将记录固定在顶部
- **收藏**：悬停卡片，点击 ⭐ 收藏记录
- **删除**：悬停卡片，点击 🗑️ 删除单条记录
- **搜索**：顶部搜索栏输入关键词实时过滤
- **清空**：列表底部"清空全部记录"按钮

### 贴图库

- 点击"导入贴图"从本地选择图片文件
- 点击贴图即可复制到剪贴板
- 悬停贴图可删除

### 设置

- **存储期限**：选择 1/3/5 天或永久，过期自动清理（置顶和收藏不受影响）
- **自动隐藏**：窗口失去焦点时自动隐藏到托盘

### 数据管理

- **导出**：将历史记录导出为 JSON 文件
- **导入**：从 JSON 文件恢复历史记录

---

## 📦 打包配置

编辑 `electron-builder.yml` 自定义打包参数：

```yaml
appId: com.clipboard.manager
productName: ClipboardManager
win:
  target:
    - nsis        # NSIS 安装包
    - portable    # 便携版
nsis:
  oneClick: false
  allowToChangeInstallationDirectory: true
  createDesktopShortcut: true
```

---

## 📄 License

MIT
