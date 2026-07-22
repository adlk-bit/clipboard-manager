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
  _searchTimer: ReturnType<typeof setTimeout> | null
  setSearchQuery: (query: string) => void

  // Settings
  retentionDays: string
  autoHide: boolean
  darkMode: boolean
  setRetentionDays: (days: string) => void
  setAutoHide: (hide: boolean) => void
  setDarkMode: (on: boolean) => void
  loadSettings: () => Promise<void>
  saveSettings: (key: string, value: string) => Promise<void>

  // UI State
  confirmDeleteId: number | null
  setConfirmDeleteId: (id: number | null) => void
  confirmClearAll: boolean
  setConfirmClearAll: (open: boolean) => void

  // Batch selection
  selectionMode: boolean
  setSelectionMode: (on: boolean) => void
  selectedIds: Set<number>
  toggleSelectId: (id: number) => void
  selectAll: () => void
  clearSelection: () => void
  confirmBatchDelete: boolean
  setConfirmBatchDelete: (open: boolean) => void
  batchDelete: () => Promise<number>
}

export const useStore = create<AppState>((set, get) => ({
  // Navigation
  currentPage: 'all',
  setCurrentPage: (page) => {
    set({ currentPage: page, searchQuery: '', selectionMode: false, selectedIds: new Set() })
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
  _searchTimer: null,
  setSearchQuery: (query) => {
    set({ searchQuery: query })
    const timer = get()._searchTimer
    if (timer) clearTimeout(timer)
    const { currentPage } = get()
    const filter = currentPage === 'favorites' ? 'favorites' : 'all'
    if (currentPage === 'all' || currentPage === 'favorites') {
      set({ _searchTimer: setTimeout(() => {
        get().loadHistory(query, filter)
      }, 200) })
    }
  },

  // Settings
  retentionDays: '3',
  autoHide: true,
  darkMode: false,
  setRetentionDays: (days) => set({ retentionDays: days }),
  setAutoHide: (hide) => set({ autoHide: hide }),
  setDarkMode: (on) => set({ darkMode: on }),
  loadSettings: async () => {
    try {
      const retention = await window.api.getSetting('retention_days')
      const autoHide = await window.api.getSetting('auto_hide')
      const darkMode = await window.api.getSetting('dark_mode')
      set({
        retentionDays: retention || '3',
        autoHide: autoHide !== 'false',
        darkMode: darkMode === 'true'
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
  setConfirmClearAll: (open) => set({ confirmClearAll: open }),

  // Batch selection
  selectionMode: false,
  setSelectionMode: (on) => set({ selectionMode: on, selectedIds: on ? get().selectedIds : new Set() }),
  selectedIds: new Set<number>(),
  toggleSelectId: (id) => {
    const next = new Set(get().selectedIds)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    set({ selectedIds: next })
  },
  selectAll: () => {
    const ids = new Set(get().historyItems.map(item => item.id))
    set({ selectedIds: ids })
  },
  clearSelection: () => set({ selectedIds: new Set() }),
  confirmBatchDelete: false,
  setConfirmBatchDelete: (open) => set({ confirmBatchDelete: open }),
  batchDelete: async () => {
    const ids = Array.from(get().selectedIds)
    if (ids.length === 0) return 0
    try {
      const count = await window.api.batchDeleteHistory(ids)
      get().clearSelection()
      get().setSelectionMode(false)
      const { currentPage } = get()
      const filter = currentPage === 'favorites' ? 'favorites' : 'all'
      await get().loadHistory(get().searchQuery, filter)
      return count
    } catch (e) {
      console.error('Batch delete failed:', e)
      return 0
    }
  }
}))
