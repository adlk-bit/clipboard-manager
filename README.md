# 📋 Clipboard Manager — Windows Clipboard History Tool

A lightweight, efficient Windows desktop clipboard manager. Runs silently in the background, auto-saves text and image clipboard entries, and provides real-time search, pin, favorite, batch management, and a sticker library — the missing power tool for your Windows clipboard.

[中文版](README_CN.md)

---

## ✨ Features

| Module | Description |
|------|------|
| 🔄 **Live Auto-Capture** | New clipboard entries appear in the open window immediately; text and images are saved in the background |
| ⏸️ **Privacy Pause** | Pause or resume capture from the history toolbar or tray; the choice persists across restarts and content copied while paused is not captured later |
| ♻️ **Smart Deduplication** | Identical text and images merge into one entry with a usage count and last-used time, keeping history compact |
| 🔥 **Frequently Used View** | Switch between newest and most-used entries to reach recurring content faster |
| 📌 **Organized Favorites** | Pin or favorite important entries, then add folders/tags and reorder favorites |
| 🔍 **Live Search** | Fuzzy-match text content as you type, lightning fast |
| 🔗 **Quick-Open URLs** | URL-only clipboard items can be opened safely in the default browser |
| 🖼️ **Sticker Library** | Import local images as stickers, click to copy to clipboard |
| ☑️ **Batch Mode** | Select multiple entries for bulk deletion |
| 🗑️ **Auto-Cleanup** | Choose 1 / 3 / 5 days or forever; expiry follows last use and removes linked image files |
| 🌙 **Refined Dark Mode** | A unified system-style light/dark interface with reduced-motion and reduced-transparency support |
| 📤 **Portable Backup & Restore** | `.clipbackup` includes text, images, stickers, favorite metadata, and safe settings; merge/replace restore and legacy JSON import are supported |
| 🛡️ **Local Data Protection** | Atomic database snapshots, startup integrity repair, restricted local-asset access, CSP, and sandboxed rendering |
| ⌨️ **Configurable Hotkey** | Record a new global shortcut directly in Settings; `Ctrl+Shift+V` is the default |
| 📊 **Storage Controls** | Set history capacity and maximum clipboard-image size, then inspect current usage |
| 🪟 **Native Window Controls** | Frameless system-style header with minimize, maximize/restore, and tray-safe close controls |

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

## 🆕 What's New in v1.0.5

- Replaced path-only JSON exports with portable `.clipbackup` archives containing history images, stickers, favorite folders/tags/order, usage metadata, and safe settings.
- Added validated merge or replace restore, duplicate handling, checksum verification, archive safety limits, and compatibility with legacy JSON backups.
- “Newest” ordering, capacity cleanup, and expiry now follow the last-used time, so a recently reused deduplicated item stays recent and is not deleted as stale.
- Expiry cleanup now removes linked image files; startup integrity repair removes missing rows/orphaned managed assets and relocates legacy external image paths into managed storage.
- Database writes now use a durable temporary file and retain the previous complete snapshot for automatic recovery after an interrupted or corrupt write.
- Enabled renderer sandboxing and web security, added a Content Security Policy, restricted `local-asset` reads to managed image directories, and changed copy IPC to accept database IDs instead of renderer-provided paths.
- The Settings footer now reads the version from the running application, and standalone TypeScript checks are supported again.
- Restored the persistent pause/resume capture control in both the history toolbar and tray, and fixed reliable click-to-record behavior for custom hotkeys.
- Corrected sidebar, title-bar, and card transparency classes so every surface changes consistently in dark mode.

---

## 🎮 Usage

| Action | How |
|------|------|
| Open window | `Ctrl+Shift+V` or double-click tray icon |
| Browse history | Sidebar → "All Records" |
| Copy an item | Click 📋 on any card, or use ↑ / ↓ then Enter |
| Change history order | In All Records, choose “Newest” or “Frequently Used” |
| Pause/resume capture | In All Records, click “Pause capture”, or use the tray menu |
| Pin | Hover card → click 📌 |
| Favorite | Hover card → click ⭐ |
| Organize favorites | In Favorites, use the card actions to edit folders/tags or reorder |
| Open a URL | Hover a URL-only item → click 🔗 |
| Delete | Hover card → click 🗑️ |
| Batch select | Click “Batch manage” below the list to enter multi-select mode |
| Search | Type in the search bar at top |
| Stickers | Sidebar → "Stickers" → Import → click image to copy |
| Settings | Sidebar → "Settings" → retention / appearance / custom hotkey / storage limits |
| Backup | Settings → Complete Backup / Restore Backup, then choose merge or replace |

---

## 📁 Project Structure

```
clipboard-manager/
├── electron/main/                 # Main process
│   ├── index.ts                   # Window, tray, hotkey
│   ├── database.ts                # SQLite CRUD
│   ├── clipboard-monitor.ts       # Clipboard polling
│   ├── ipc-handlers.ts            # IPC handlers
│   ├── backup.ts                  # Portable backup validation/archive
│   ├── asset-paths.ts             # Managed local-asset boundaries
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
