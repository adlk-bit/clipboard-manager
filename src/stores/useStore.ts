import { create } from 'zustand'
import type { HistoryItem, StickerItem, PageView, HistoryStats } from '../types'

interface AppState {
  // Navigation
  currentPage: PageView
  setCurrentPage: (page: PageView) => void

  // History
  historyItems: HistoryItem[]
  setHistoryItems: (items: HistoryItem[]) => void
  historySort: 'recent' | 'frequent'
  setHistorySort: (sort: 'recent' | 'frequent') => void
  loadHistory: (search?: string, filter?: string) => Promise<void>
  keyboardActiveId: number | null
  setKeyboardActiveId: (id: number | null) => void
  favoriteFolder: string
  favoriteFolders: string[]
  setFavoriteFolder: (folder: string) => void
  loadFavoriteFolders: () => Promise<void>

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
  darkMode: boolean
  hotkey: string
  monitorPaused: boolean
  maxHistoryItems: string
  maxImageSizeMb: string
  historyStats: HistoryStats
  setRetentionDays: (days: string) => void
  setDarkMode: (on: boolean) => void
  setHotkey: (hotkey: string) => void
  setMonitorPaused: (paused: boolean) => void
  toggleMonitorPaused: () => Promise<void>
  loadMonitorPaused: () => Promise<void>
  setMaxHistoryItems: (value: string) => void
  setMaxImageSizeMb: (value: string) => void
  loadHistoryStats: () => Promise<void>
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
    } else if (page === 'all' || page === 'favorites') {
      if (page !== 'favorites') set({ favoriteFolder: '' })
      get().loadHistory('', page === 'favorites' ? 'favorites' : 'all')
      if (page === 'favorites') get().loadFavoriteFolders()
    }
  },

  // History
  historyItems: [],
  setHistoryItems: (items) => set({ historyItems: items }),
  historySort: 'recent',
  setHistorySort: (sort) => {
    set({ historySort: sort })
    get().loadHistory(get().searchQuery, 'all')
  },
  keyboardActiveId: null,
  setKeyboardActiveId: (id) => set({ keyboardActiveId: id }),
  favoriteFolder: '',
  favoriteFolders: [],
  setFavoriteFolder: (folder) => {
    set({ favoriteFolder: folder })
    get().loadHistory(get().searchQuery, 'favorites')
  },
  loadFavoriteFolders: async () => {
    try {
      set({ favoriteFolders: await window.api.getFavoriteFolders() })
    } catch (e) {
      console.error('Failed to load favorite folders:', e)
    }
  },
  loadHistory: async (search, filter) => {
    try {
      const activeFilter = filter || 'all'
      const folder = activeFilter === 'favorites' ? get().favoriteFolder : ''
      const sort = activeFilter === 'all' ? get().historySort : 'recent'
      const items = await window.api.getHistory(search || '', activeFilter, folder, sort)
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
  darkMode: false,
  hotkey: 'Ctrl+Shift+V',
  monitorPaused: false,
  maxHistoryItems: '500',
  maxImageSizeMb: '10',
  historyStats: { itemCount: 0, imageBytes: 0 },
  setRetentionDays: (days) => set({ retentionDays: days }),
  setDarkMode: (on) => set({ darkMode: on }),
  setHotkey: (hotkey) => set({ hotkey }),
  setMonitorPaused: (paused) => set({ monitorPaused: paused }),
  toggleMonitorPaused: async () => {
    const previous = get().monitorPaused
    const next = !previous
    set({ monitorPaused: next })
    try {
      const paused = await window.api.setMonitorPaused(next)
      set({ monitorPaused: paused })
    } catch (e) {
      set({ monitorPaused: previous })
      console.error('Failed to update clipboard monitor state:', e)
    }
  },
  loadMonitorPaused: async () => {
    try {
      set({ monitorPaused: await window.api.getMonitorPaused() })
    } catch (e) {
      console.error('Failed to load clipboard monitor state:', e)
    }
  },
  setMaxHistoryItems: (value) => set({ maxHistoryItems: value }),
  setMaxImageSizeMb: (value) => set({ maxImageSizeMb: value }),
  loadHistoryStats: async () => {
    try {
      set({ historyStats: await window.api.getHistoryStats() })
    } catch (e) {
      console.error('Failed to load history stats:', e)
    }
  },
  loadSettings: async () => {
    try {
      const retention = await window.api.getSetting('retention_days')
      const darkMode = await window.api.getSetting('dark_mode')
      const hotkey = await window.api.getSetting('hotkey')
      const maxHistoryItems = await window.api.getSetting('max_history_items')
      const maxImageSizeMb = await window.api.getSetting('max_image_size_mb')
      set({
        retentionDays: retention || '3',
        darkMode: darkMode === 'true',
        hotkey: hotkey || 'Ctrl+Shift+V',
        maxHistoryItems: maxHistoryItems || '500',
        maxImageSizeMb: maxImageSizeMb || '10'
      })
      await get().loadHistoryStats()
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
