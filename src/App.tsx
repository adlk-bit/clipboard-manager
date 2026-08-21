import { useEffect, useState, useCallback } from 'react'
import Layout from './components/Layout'
import Sidebar from './components/Sidebar'
import HistoryList from './components/HistoryList'
import SearchBar from './components/SearchBar'
import StickerGrid from './components/StickerGrid'
import EmojiPicker from './components/EmojiPicker'
import SettingsPanel from './components/SettingsPanel'
import DevicesPanel from './components/DevicesPanel'
import ConfirmDialog from './components/ConfirmDialog'
import EditCopyDialog from './components/EditCopyDialog'
import Toast from './components/Toast'
import { useStore } from './stores/useStore'
import type { HistoryItem } from './types'
import { useI18n } from './lib/i18n'

export default function App() {
  const { t } = useI18n()
  const currentPage = useStore((s) => s.currentPage)
  const loadHistory = useStore((s) => s.loadHistory)
  const loadSettings = useStore((s) => s.loadSettings)
  const confirmDeleteId = useStore((s) => s.confirmDeleteId)
  const confirmClearAll = useStore((s) => s.confirmClearAll)
  const confirmBatchDelete = useStore((s) => s.confirmBatchDelete)
  const historyItems = useStore((s) => s.historyItems)
  const selectionMode = useStore((s) => s.selectionMode)
  const keyboardActiveId = useStore((s) => s.keyboardActiveId)
  const setKeyboardActiveId = useStore((s) => s.setKeyboardActiveId)
  const loadMonitorPaused = useStore((s) => s.loadMonitorPaused)
  const setMonitorPaused = useStore((s) => s.setMonitorPaused)

  const [toast, setToast] = useState<{ id: number; message: string; type: 'success' | 'info' } | null>(null)
  const [toastKey, setToastKey] = useState(0)
  const [editCopyItem, setEditCopyItem] = useState<HistoryItem | null>(null)

  const showToast = useCallback((message: string, type: 'success' | 'info' = 'success') => {
    setToastKey(k => k + 1)
    setToast({ id: toastKey, message, type })
  }, [toastKey])

  const clearToast = useCallback(() => {
    setToast(null)
  }, [])

  useEffect(() => {
    loadHistory()
    loadSettings()
    loadMonitorPaused()
  }, [])

  useEffect(() => window.api.onMonitorPausedChanged(setMonitorPaused), [setMonitorPaused])

  useEffect(() => {
    return window.api.onHistoryChanged(() => {
      const state = useStore.getState()
      if (state.currentPage === 'all' || state.currentPage === 'favorites') {
        state.loadHistory(state.searchQuery, state.currentPage === 'favorites' ? 'favorites' : 'all')
      }
      state.loadHistoryStats()
    })
  }, [])

  useEffect(() => {
    const handleKeyDown = async (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const isTyping = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || target?.isContentEditable
      if (isTyping || selectionMode || (currentPage !== 'all' && currentPage !== 'favorites') || event.ctrlKey || event.altKey || event.metaKey) return

      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        if (historyItems.length === 0) return
        event.preventDefault()
        const currentIndex = historyItems.findIndex((item) => item.id === keyboardActiveId)
        const direction = event.key === 'ArrowDown' ? 1 : -1
        const nextIndex = currentIndex === -1
          ? (direction === 1 ? 0 : historyItems.length - 1)
          : Math.max(0, Math.min(historyItems.length - 1, currentIndex + direction))
        setKeyboardActiveId(historyItems[nextIndex].id)
        return
      }

      if (event.key === 'Enter' && keyboardActiveId !== null) {
        const item = historyItems.find((historyItem) => historyItem.id === keyboardActiveId)
        if (!item) return
        event.preventDefault()
        const result = await window.api.copyToClipboard(item.id)
        if (result.success) {
          setKeyboardActiveId(null)
          await window.api.hideWindow()
        }
      }
    }

    const clearKeyboardSelection = () => setKeyboardActiveId(null)
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('blur', clearKeyboardSelection)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('blur', clearKeyboardSelection)
    }
  }, [currentPage, historyItems, keyboardActiveId, selectionMode, setKeyboardActiveId])

  return (
    <Layout>
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col bg-[#f7f7f8] dark:bg-[#1c1c1e]">
        {/* Header */}
        <div className="app-header drag-region flex h-11 shrink-0 items-center justify-between gap-2 border-b border-[#e2e2e6] bg-white px-3 dark:border-white/10 dark:bg-[#242427]">
          <h1 className="no-drag truncate text-sm font-semibold text-[#242428] dark:text-[#f5f5f7]">
            {t(`page.${currentPage}`)}
          </h1>
          {(currentPage === 'all' || currentPage === 'favorites') && (
            <div className="no-drag">
              <SearchBar />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {(currentPage === 'all' || currentPage === 'favorites') && <HistoryList onCopy={showToast} onEdit={setEditCopyItem} />}
          {currentPage === 'emoji' && <EmojiPicker onCopy={showToast} />}
          {currentPage === 'stickers' && <StickerGrid onCopy={showToast} />}
          {currentPage === 'devices' && <DevicesPanel />}
          {currentPage === 'settings' && <SettingsPanel />}
        </div>

      </div>

      {/* Toast notification */}
      {toast && <Toast key={toastKey} message={toast.message} type={toast.type} onClose={clearToast} />}

      {/* Confirm dialogs */}
      {confirmDeleteId !== null && <ConfirmDialog type="delete" />}
      {confirmClearAll && <ConfirmDialog type="clearAll" />}
      {confirmBatchDelete && <ConfirmDialog type="batchDelete" />}
      {editCopyItem && (
        <EditCopyDialog
          key={editCopyItem.id}
          item={editCopyItem}
          onClose={() => setEditCopyItem(null)}
          onCopied={showToast}
        />
      )}
    </Layout>
  )
}
