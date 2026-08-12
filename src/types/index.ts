export interface HistoryItem {
  id: number
  type: 'text' | 'image'
  content: string | null
  image_path: string | null
  is_pinned: number
  is_favorite: number
  created_at: string
  favorite_folder: string
  favorite_tags: string
  favorite_sort_order: number
  use_count: number
  last_used_at: string
  content_hash: string
}

export interface StickerItem {
  id: number
  name: string | null
  image_path: string
  created_at: string
}

export interface HistoryStats {
  itemCount: number
  imageBytes: number
}

export interface BackupExportResult {
  filePath: string
  historyCount: number
  stickerCount: number
  skippedFiles: number
}

export type BackupImportResult =
  | { status: 'cancelled' }
  | { status: 'error'; error: string }
  | {
      status: 'success'
      mode: 'merge' | 'replace'
      source: 'portable' | 'legacy-json'
      historyCount: number
      stickerCount: number
      skippedItems: number
      skippedDuplicates: number
    }

export type PageView = 'all' | 'favorites' | 'emoji' | 'stickers' | 'settings'

export interface ElectronApi {
  getHistory: (search?: string, filter?: string, folder?: string, sort?: 'recent' | 'frequent') => Promise<HistoryItem[]>
  togglePin: (id: number) => Promise<void>
  toggleFavorite: (id: number) => Promise<void>
  deleteHistory: (id: number) => Promise<void>
  clearAllHistory: () => Promise<void>
  batchDeleteHistory: (ids: number[]) => Promise<number>
  copyToClipboard: (id: number) => Promise<{ success: boolean; type?: 'text' | 'image'; error?: string }>
  writeTextToClipboard: (text: string) => Promise<{ success: boolean; type?: 'text'; error?: string }>
  getFavoriteFolders: () => Promise<string[]>
  updateFavoriteMetadata: (id: number, folder: string, tags: string) => Promise<void>
  moveFavorite: (id: number, direction: 'up' | 'down') => Promise<boolean>
  hideWindow: () => Promise<void>
  minimizeWindow: () => Promise<void>
  toggleMaximizeWindow: (isMaximized: boolean) => Promise<boolean>
  isWindowMaximized: () => Promise<boolean>
  closeWindow: () => Promise<void>
  onWindowMaximizedChanged: (callback: (isMaximized: boolean) => void) => () => void
  getHistoryStats: () => Promise<HistoryStats>
  onHistoryChanged: (callback: () => void) => () => void
  openExternalUrl: (url: string) => Promise<{ success: boolean; error?: string }>
  getSetting: (key: string) => Promise<string | null>
  setSetting: (key: string, value: string) => Promise<void>
  setHotkey: (hotkey: string) => Promise<{ success: boolean; hotkey?: string; error?: string }>
  getMonitorPaused: () => Promise<boolean>
  setMonitorPaused: (paused: boolean) => Promise<boolean>
  onMonitorPausedChanged: (callback: (paused: boolean) => void) => () => void
  getStickers: () => Promise<StickerItem[]>
  importStickers: () => Promise<StickerItem[]>
  deleteSticker: (id: number) => Promise<StickerItem[]>
  sendSticker: (id: number) => Promise<{ success: boolean; error?: string }>
  sendEmoji: (emoji: string) => Promise<{ success: boolean; error?: string }>
  exportHistory: () => Promise<BackupExportResult | null>
  importHistory: () => Promise<BackupImportResult>
  getAppVersion: () => Promise<string>
}

declare global {
  interface Window {
    api: ElectronApi
  }
}
