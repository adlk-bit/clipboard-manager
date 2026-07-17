export interface HistoryItem {
  id: number
  type: 'text' | 'image'
  content: string | null
  image_path: string | null
  is_pinned: number
  is_favorite: number
  created_at: string
}

export interface StickerItem {
  id: number
  name: string | null
  image_path: string
  created_at: string
}

export type PageView = 'all' | 'favorites' | 'stickers' | 'settings'

export interface ElectronApi {
  getHistory: (search?: string, filter?: string) => Promise<HistoryItem[]>
  togglePin: (id: number) => Promise<void>
  toggleFavorite: (id: number) => Promise<void>
  deleteHistory: (id: number) => Promise<void>
  clearAllHistory: () => Promise<void>
  copyToClipboard: (item: HistoryItem) => Promise<void>
  getSetting: (key: string) => Promise<string | null>
  setSetting: (key: string, value: string) => Promise<void>
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
