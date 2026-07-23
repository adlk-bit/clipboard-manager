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

export type PageView = 'all' | 'favorites' | 'stickers' | 'settings'

export interface ElectronApi {
  getHistory: (search?: string, filter?: string, folder?: string) => Promise<HistoryItem[]>
  togglePin: (id: number) => Promise<void>
  toggleFavorite: (id: number) => Promise<void>
  deleteHistory: (id: number) => Promise<void>
  clearAllHistory: () => Promise<void>
  batchDeleteHistory: (ids: number[]) => Promise<number>
  copyToClipboard: (item: HistoryItem) => Promise<void>
  getFavoriteFolders: () => Promise<string[]>
  updateFavoriteMetadata: (id: number, folder: string, tags: string) => Promise<void>
  moveFavorite: (id: number, direction: 'up' | 'down') => Promise<boolean>
  hideWindow: () => Promise<void>
  getHistoryStats: () => Promise<HistoryStats>
  onHistoryChanged: (callback: () => void) => () => void
  openExternalUrl: (url: string) => Promise<{ success: boolean; error?: string }>
  getSetting: (key: string) => Promise<string | null>
  setSetting: (key: string, value: string) => Promise<void>
  setHotkey: (hotkey: string) => Promise<{ success: boolean; hotkey?: string; error?: string }>
  getStickers: () => Promise<StickerItem[]>
  importStickers: () => Promise<StickerItem[]>
  deleteSticker: (id: number) => Promise<StickerItem[]>
  sendSticker: (imagePath: string) => Promise<boolean>
  exportHistory: () => Promise<string | null>
  importHistory: () => Promise<number>
}

declare global {
  interface Window {
    api: ElectronApi
  }
}
