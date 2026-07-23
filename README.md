# 📋 Clipboard Manager — Windows Clipboard History Tool

A lightweight, efficient Windows desktop clipboard manager. Runs silently in the background, auto-saves text and image clipboard entries, and provides real-time search, pin, favorite, batch management, and a sticker library — the missing power tool for your Windows clipboard.

[中文版](README_CN.md)

---

## ✨ Features

| Module | Description |
|------|------|
| 🔄 **Live Auto-Capture** | New clipboard entries appear in the open window immediately; text and images are saved in the background |
| 📌 **Organized Favorites** | Pin or favorite important entries, then add folders/tags and reorder favorites |
| 🔍 **Live Search** | Fuzzy-match text content as you type, lightning fast |
| 🔗 **Quick-Open URLs** | URL-only clipboard items can be opened safely in the default browser |
| 🖼️ **Sticker Library** | Import local images as stickers, click to copy to clipboard |
| ☑️ **Batch Mode** | Long-press any card to enter multi-select; delete or manage in bulk |
| 🗑️ **Auto-Cleanup** | Choose 1 / 3 / 5 days or forever; expired entries clean themselves |
| 🌙 **Refined Dark Mode** | A unified system-style light/dark interface with reduced-motion and reduced-transparency support |
| 📤 **Backup & Restore** | Export/import history as JSON for data migration |
| ⌨️ **Configurable Hotkey** | Record a new global shortcut directly in Settings; `Ctrl+Shift+V` is the default |
| 📊 **Storage Controls** | Set history capacity and maximum clipboard-image size, then inspect current usage |
| 🎨 **Frameless Design** | Rounded translucent window, auto-centers on active monitor |

---

## 🚀 Installation

### Download Installer

Go to [Releases](https://github.com/adlk-bit/clipboard-manager/releases) and download the latest `ClipboardManager Setup x.x.x.exe`. Double-click to install.

### Build from Source

```bash
# Clone the repo
git clone https://github.com/adlk-bit/clipboard-manager.git
cd clipboard-manager

# Install dependencies
npm install

# Dev mode (hot reload)
npm run dev

# Production build & package
npm run dist
```

> **Requirements:** Node.js ≥ 18 · npm ≥ 9 · Windows 10/11

---

## 🆕 What's New in v1.0.2

- Live history refresh while the app window is open, plus keyboard navigation with ↑ / ↓ and Enter to copy.
- Favorites can now be grouped with folders and tags, ordered manually, and filtered by folder.
- URL-only history items offer a safe open-in-browser action; non-HTTP(S) links are rejected.
- Added history-capacity and image-size limits, storage usage statistics, and automatic cleanup of eligible old records.
- You can record a custom global shortcut in Settings.
- Refined the visual system with a consistent dark theme, improved materials, typography, feedback, and accessibility preferences.

---

## 🎮 Usage

| Action | How |
|------|------|
| Open window | `Ctrl+Shift+V` or double-click tray icon |
| Browse history | Sidebar → "All Records" |
| Copy an item | Click 📋 on any card, or use ↑ / ↓ then Enter |
| Pin | Hover card → click 📌 |
| Favorite | Hover card → click ⭐ |
| Organize favorites | In Favorites, use the card actions to edit folders/tags or reorder |
| Open a URL | Hover a URL-only item → click 🔗 |
| Delete | Hover card → click 🗑️ |
| Batch select | Click “Batch manage” below the list to enter multi-select mode |
| Search | Type in the search bar at top |
| Stickers | Sidebar → "Stickers" → Import → click image to copy |
| Settings | Sidebar → "Settings" → retention / appearance / custom hotkey / storage limits |
| Backup | Settings → Export / Import |

---

## 📁 Project Structure

```
clipboard-manager/
├── electron/main/                 # Main process
│   ├── index.ts                   # Window, tray, hotkey
│   ├── database.ts                # SQLite CRUD
│   ├── clipboard-monitor.ts       # Clipboard polling
│   ├── ipc-handlers.ts            # IPC handlers
│   └── scheduler.ts               # Expiry cleanup scheduler
├── electron/preload/
│   └── index.ts                   # Secure bridge API
├── src/                           # Renderer (React)
│   ├── App.tsx
│   ├── components/
│   │   ├── Layout.tsx             # Shell layout
│   │   ├── Sidebar.tsx            # Nav (All / Favorites / Stickers / Settings)
│   │   ├── HistoryList.tsx        # History list
│   │   ├── HistoryCard.tsx        # Card (copy / pin / fav / delete)
│   │   ├── SearchBar.tsx          # Search input
│   │   ├── StickerGrid.tsx        # Sticker grid
│   │   ├── StickerCard.tsx        # Sticker card
│   │   ├── SettingsPanel.tsx      # Settings panel
│   │   ├── ExportImport.tsx       # Export & import
│   │   ├── ConfirmDialog.tsx      # Confirm dialog
│   │   └── Toast.tsx              # Toast notification
│   ├── stores/useStore.ts         # Zustand state
│   ├── types/index.ts             # TypeScript types
│   └── styles/index.css           # Tailwind + global styles
├── resources/                     # Static assets
│   ├── icon.png                   # App icon (256×256)
│   ├── icon.ico                   # Windows icon
│   └── tray-icon.png              # Tray icon (16×16)
├── electron.vite.config.ts
├── electron-builder.yml
├── tailwind.config.js
└── package.json
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|------|
| Framework | Electron 43 |
| UI | React 18 + TypeScript |
| Build | Vite 5 + electron-vite 3 |
| Styling | Tailwind CSS 3 |
| State | Zustand 5 |
| Database | sql.js (SQLite WASM) |
| Packaging | electron-builder (NSIS) |

---

## 📦 Custom Packaging

Edit `electron-builder.yml`:

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
