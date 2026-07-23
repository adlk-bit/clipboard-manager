import { useEffect, useState, useCallback } from 'react'
import Layout from './components/Layout'
import Sidebar from './components/Sidebar'
import HistoryList from './components/HistoryList'
import SearchBar from './components/SearchBar'
import StickerGrid from './components/StickerGrid'
import SettingsPanel from './components/SettingsPanel'
import ConfirmDialog from './components/ConfirmDialog'
import Toast from './components/Toast'
import { useStore } from './stores/useStore'

export default function App() {
  const currentPage = useStore((s) => s.currentPage)
  const loadHistory = useStore((s) => s.loadHistory)
  const confirmDeleteId = useStore((s) => s.confirmDeleteId)
  const confirmClearAll = useStore((s) => s.confirmClearAll)
  const confirmBatchDelete = useStore((s) => s.confirmBatchDelete)
  const darkMode = useStore((s) => s.darkMode)
  const historyItems = useStore((s) => s.historyItems)
  const selectionMode = useStore((s) => s.selectionMode)
  const keyboardActiveId = useStore((s) => s.keyboardActiveId)
  const setKeyboardActiveId = useStore((s) => s.setKeyboardActiveId)

  const [toast, setToast] = useState<{ id: number; message: string; type: 'success' | 'info' } | null>(null)
  const [toastKey, setToastKey] = useState(0)

  const showToast = useCallback((message: string, type: 'success' | 'info' = 'success') => {
    setToastKey(k => k + 1)
    setToast({ id: toastKey, message, type })
  }, [toastKey])

  const clearToast = useCallback(() => {
    setToast(null)
  }, [])

  useEffect(() => {
    loadHistory()
  }, [])

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
        await window.api.copyToClipboard(item)
        setKeyboardActiveId(null)
        await window.api.hideWindow()
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

      <div className="flex-1 flex flex-col min-w-0 bg-[#f7f7f8] dark:bg-[#1c1c1e]">
        {/* Header */}
        <div className="app-header drag-region flex items-center justify-between px-5 py-3 bg-white/72 dark:bg-[#2c2c2e]/82 border-b border-white/70 dark:border-white/10 backdrop-blur-xl shrink-0">
          <h1 className="text-[15px] leading-5 font-semibold tracking-[-0.01em] text-[#1d1d1f] dark:text-[#f5f5f7] no-drag">
            {currentPage === 'all' && '剪贴板历史'}
            {currentPage === 'favorites' && '收藏记录'}
            {currentPage === 'stickers' && '贴图库'}
            {currentPage === 'settings' && '设置'}
          </h1>
          {(currentPage === 'all' || currentPage === 'favorites') && (
            <div className="no-drag">
              <SearchBar />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {(currentPage === 'all' || currentPage === 'favorites') && <HistoryList onCopy={showToast} />}
          {currentPage === 'stickers' && <StickerGrid onCopy={showToast} />}
          {currentPage === 'settings' && <SettingsPanel />}
        </div>

        {/* Status bar */}
        <div className="app-statusbar px-5 py-2 border-t border-white/70 dark:border-white/10 bg-white/60 dark:bg-[#2c2c2e]/70 text-[11px] leading-4 text-[#6e6e73] dark:text-[#98989d] backdrop-blur-xl shrink-0">
          {currentPage === 'all' && <span>自动记录中 · 点击卡片右侧 📋 图标复制 · 按 Ctrl+Shift+V 唤起窗口</span>}
          {currentPage === 'favorites' && <span>收藏的记录不受过期清理影响</span>}
          {currentPage === 'stickers' && <span>点击贴图即可复制到剪贴板</span>}
          {currentPage === 'settings' && <span>修改设置后自动保存</span>}
        </div>
      </div>

      {/* Toast notification */}
      {toast && <Toast key={toastKey} message={toast.message} type={toast.type} onClose={clearToast} />}

      {/* Confirm dialogs */}
      {confirmDeleteId !== null && <ConfirmDialog type="delete" />}
      {confirmClearAll && <ConfirmDialog type="clearAll" />}
      {confirmBatchDelete && <ConfirmDialog type="batchDelete" />}
    </Layout>
  )
}
