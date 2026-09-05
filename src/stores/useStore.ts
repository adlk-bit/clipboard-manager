import { create } from 'zustand'
import type { HistoryItem, StickerItem, PageView, HistoryStats, AutoLaunchUpdateResult } from '../types'
import type { AppLanguage } from '../lib/i18n'
import type { HistoryContentType } from '../../shared/history-query'

interface AppState {
  // Navigation
  currentPage: PageView
  setCurrentPage: (page: PageView) => void

  // History
  historyItems: HistoryItem[]
  historyLoading: boolean
  historyError: boolean
  _historyRequest: number
  contentType: HistoryContentType
  setContentType: (type: HistoryContentType) => void
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
  sensitivePreview: boolean
  language: AppLanguage
  hotkey: string
  autoLaunch: boolean
  autoLaunchSupported: boolean
  monitorPaused: boolean
  maxHistoryItems: string
  maxImageSizeMb: string
  historyStats: HistoryStats
  setRetentionDays: (days: string) => void
  setDarkMode: (on: boolean) => void
  setSensitivePreview: (on: boolean) => void
  setLanguage: (language: AppLanguage) => void
  setHotkey: (hotkey: string) => void
  updateAutoLaunch: (enabled: boolean) => Promise<AutoLaunchUpdateResult>
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
    const timer = get()._searchTimer
    if (timer) clearTimeout(timer)
    set({ currentPage: page, searchQuery: '', selectionMode: false, selectedIds: new Set(), keyboardActiveId: null,
      contentType: 'all', historyItems: [], historyLoading: false, historyError: false, _searchTimer: null, _historyRequest: get()._historyRequest + 1 })
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
  historyLoading: false,
  historyError: false,
  _historyRequest: 0,
  contentType: 'all',
  setContentType: (type) => {
    set({ contentType: type, keyboardActiveId: null, selectedIds: new Set() })
    void get().loadHistory()
  },
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
    const state = get()
    if (state.currentPage !== 'all' && state.currentPage !== 'favorites') return
    const activeFilter = state.currentPage === 'favorites' ? 'favorites' : 'all'
    const query = search ?? state.searchQuery
    // Ignore callbacks captured before a navigation or search change.
    if ((filter && filter !== activeFilter) || query !== state.searchQuery) return
    if (state._searchTimer) clearTimeout(state._searchTimer)
    const request = state._historyRequest + 1
    set({ _historyRequest: request, _searchTimer: null, historyLoading: true, historyError: false })
    try {
      const folder = activeFilter === 'favorites' ? state.favoriteFolder : ''
      const sort = activeFilter === 'all' ? state.historySort : 'recent'
      const items = await window.api.getHistory(query, activeFilter, folder, sort, state.contentType)
      if (get()._historyRequest !== request) return
      const visibleIds = new Set(items.map((item) => item.id))
      set({ historyItems: items, historyLoading: false,
        keyboardActiveId: visibleIds.has(get().keyboardActiveId!) ? get().keyboardActiveId : null,
        selectedIds: new Set([...get().selectedIds].filter((id) => visibleIds.has(id))) })
    } catch (e) {
      if (get()._historyRequest !== request) return
      set({ historyLoading: false, historyError: true, historyItems: [], selectedIds: new Set(), keyboardActiveId: null })
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
    set({ searchQuery: query.slice(0, 500), keyboardActiveId: null, selectedIds: new Set(),
      _historyRequest: get()._historyRequest + 1, historyError: false })
    const timer = get()._searchTimer
    if (timer) clearTimeout(timer)
    const { currentPage } = get()
    if (currentPage === 'all' || currentPage === 'favorites') {
      set({ historyLoading: true, _searchTimer: setTimeout(() => { void get().loadHistory() }, 200) })
    }
  },

  // Settings
  retentionDays: '3',
  darkMode: false,
  sensitivePreview: true,
  language: 'zh-CN',
  hotkey: 'Ctrl+Shift+V',
  autoLaunch: false,
  autoLaunchSupported: false,
  monitorPaused: false,
  maxHistoryItems: '500',
  maxImageSizeMb: '10',
  historyStats: { itemCount: 0, imageBytes: 0 },
  setRetentionDays: (days) => set({ retentionDays: days }),
  setDarkMode: (on) => set({ darkMode: on }),
  setSensitivePreview: (on) => set({ sensitivePreview: on }),
  setLanguage: (language) => set({ language }),
  setHotkey: (hotkey) => set({ hotkey }),
  updateAutoLaunch: async (enabled) => {
    const previous = get().autoLaunch
    set({ autoLaunch: enabled })
    try {
      const result = await window.api.setAutoLaunch(enabled)
      set({ autoLaunch: result.enabled, autoLaunchSupported: result.supported })
      return result
    } catch (error) {
      set({ autoLaunch: previous })
      return {
        success: false,
        supported: get().autoLaunchSupported,
        configured: previous,
        enabled: previous,
        error: String(error),
      }
    }
  },
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
      const [retention, darkMode, sensitivePreview, language, hotkey, maxHistoryItems, maxImageSizeMb, autoLaunch] = await Promise.all([
        window.api.getSetting('retention_days'), window.api.getSetting('dark_mode'),
        window.api.getSetting('sensitive_preview'), window.api.getSetting('language'),
        window.api.getSetting('hotkey'), window.api.getSetting('max_history_items'),
        window.api.getSetting('max_image_size_mb'), window.api.getAutoLaunch(),
      ])
      set({
        retentionDays: retention || '3',
        darkMode: darkMode === 'true',
        sensitivePreview: sensitivePreview !== 'false',
        language: language === 'en' ? 'en' : 'zh-CN',
        hotkey: hotkey || 'Ctrl+Shift+V',
        autoLaunch: autoLaunch.enabled,
        autoLaunchSupported: autoLaunch.supported,
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
