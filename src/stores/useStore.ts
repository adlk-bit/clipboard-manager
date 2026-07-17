import { create } from 'zustand'
import type { HistoryItem, StickerItem, PageView } from '../types'

interface AppState {
  // Navigation
  currentPage: PageView
  setCurrentPage: (page: PageView) => void

  // History
  historyItems: HistoryItem[]
  setHistoryItems: (items: HistoryItem[]) => void
  loadHistory: (search?: string, filter?: string) => Promise<void>

  // Stickers
  stickers: StickerItem[]
  setStickers: (items: StickerItem[]) => void
  loadStickers: () => Promise<void>

  // Search
  searchQuery: string
  setSearchQuery: (query: string) => void

  // Settings
  retentionDays: string
  autoHide: boolean
  setRetentionDays: (days: string) => void
  setAutoHide: (hide: boolean) => void
  loadSettings: () => Promise<void>
  saveSettings: (key: string, value: string) => Promise<void>

  // UI State
  confirmDeleteId: number | null
  setConfirmDeleteId: (id: number | null) => void
  confirmClearAll: boolean
  setConfirmClearAll: (open: boolean) => void
}

export const useStore = create<AppState>((set, get) => ({
  // Navigation
  currentPage: 'all',
  setCurrentPage: (page) => {
    set({ currentPage: page, searchQuery: '' })
    if (page === 'stickers') {
      get().loadStickers()
    } else if (page === 'settings') {
      get().loadSettings()
    } else {
      get().loadHistory('', page === 'favorites' ? 'favorites' : 'all')
    }
  },

  // History
  historyItems: [],
  setHistoryItems: (items) => set({ historyItems: items }),
  loadHistory: async (search, filter) => {
    try {
      const items = await window.api.getHistory(search || '', filter || 'all')
      set({ historyItems: items })
    } catch (e) {
      console.error('Failed to load history:', e)
    }
  },

  // Stickers
  stickers: [],
  setStickers: (items) => set({ stickers: items }),
  loadStickers: async () => {
    try {
      const items = await window.api.getStickers()
      set({ stickers: items })
    } catch (e) {
      console.error('Failed to load stickers:', e)
    }
  },

  // Search
  searchQuery: '',
  setSearchQuery: (query) => {
    set({ searchQuery: query })
    const { currentPage } = get()
    const filter = currentPage === 'favorites' ? 'favorites' : 'all'
    if (currentPage === 'all' || currentPage === 'favorites') {
      get().loadHistory(query, filter)
    }
  },

  // Settings
  retentionDays: '3',
  autoHide: true,
  setRetentionDays: (days) => set({ retentionDays: days }),
  setAutoHide: (hide) => set({ autoHide: hide }),
  loadSettings: async () => {
    try {
      const retention = await window.api.getSetting('retention_days')
      const autoHide = await window.api.getSetting('auto_hide')
      set({
        retentionDays: retention || '3',
        autoHide: autoHide !== 'false'
      })
    } catch (e) {
      console.error('Failed to load settings:', e)
    }
  },
  saveSettings: async (key, value) => {
    try {
      await window.api.setSetting(key, value)
    } catch (e) {
      console.error('Failed to save settings:', e)
    }
  },

  // UI State
  confirmDeleteId: null,
  setConfirmDeleteId: (id) => set({ confirmDeleteId: id }),
  confirmClearAll: false,
  setConfirmClearAll: (open) => set({ confirmClearAll: open })
}))
