import TemplatesPanel, { TemplateEditor } from './components/TemplatesPanel'
import OcrDialog from './components/OcrDialog'
import QueueBar from './components/QueueBar'
import { useEffect, useState, useCallback, useRef } from 'react'
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
  const { t, language } = useI18n()
  const currentPage = useStore((s) => s.currentPage)
  const loadHistory = useStore((s) => s.loadHistory)
  const loadSettings = useStore((s) => s.loadSettings)
  const confirmDeleteId = useStore((s) => s.confirmDeleteId)
  const confirmClearAll = useStore((s) => s.confirmClearAll)
  const confirmBatchDelete = useStore((s) => s.confirmBatchDelete)
  const historyItems = useStore((s) => s.historyItems)
  const selectionMode = useStore((s) => s.selectionMode)
  const historyLoading = useStore((s) => s.historyLoading)
  const keyboardActiveId = useStore((s) => s.keyboardActiveId)
  const setKeyboardActiveId = useStore((s) => s.setKeyboardActiveId)
  const loadMonitorPaused = useStore((s) => s.loadMonitorPaused)
  const setMonitorPaused = useStore((s) => s.setMonitorPaused)

  const [toast, setToast] = useState<{ id: number; message: string; type: 'success' | 'info' } | null>(null)
  const [toastKey, setToastKey] = useState(0)
  const [editCopyItems, setEditCopyItems] = useState<HistoryItem[] | null>(null)
  const [templateItem, setTemplateItem] = useState<HistoryItem | null>(null)
  const [ocrItem, setOcrItem] = useState<HistoryItem | null>(null)
  const copyingRef = useRef(false)
  const openEditor = useCallback((item: HistoryItem) => setEditCopyItems([item]), [])

  const showToast = useCallback((message: string, type: 'success' | 'info' = 'success') => {
    setToastKey(k => k + 1)
    setToast({ id: Date.now(), message, type })
  }, [])

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
      if (state.currentPage === 'settings') void state.loadHistoryStats()
    })
  }, [])

  useEffect(() => {
    const handleKeyDown = async (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const isTyping = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || target?.isContentEditable
      const isSearch = target?.id === 'history-search'
      if (event.isComposing || event.defaultPrevented || editCopyItems || confirmDeleteId !== null || confirmClearAll || confirmBatchDelete || document.querySelector('[role="dialog"]')) return
      if (currentPage !== 'all' && currentPage !== 'favorites') return
      const state = useStore.getState()
      if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 'f' && (!isTyping || isSearch)) {
        event.preventDefault()
        const input = document.getElementById('history-search') as HTMLInputElement | null
        input?.focus(); input?.select()
        return
      }
      if (isTyping && !isSearch) return
      if (event.key === 'Escape') {
        event.preventDefault()
        if (selectionMode) state.setSelectionMode(false)
        else if (state.searchQuery) state.setSearchQuery('')
        else await window.api.hideWindow()
        return
      }
      if (selectionMode || historyLoading) return

      const copyItem = async (item: HistoryItem | undefined) => {
        if (!item || copyingRef.current || event.repeat) return
        copyingRef.current = true
        try {
          const result = await window.api.copyToClipboard(item.id)
          if (!result.success) throw new Error('Copy failed')
          setKeyboardActiveId(null)
          await window.api.hideWindow()
        } catch { showToast(t('card.copyFailed'), 'info') }
        finally { copyingRef.current = false }
      }
      if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && /^[1-9]$/.test(event.key)) {
        event.preventDefault()
        await copyItem(historyItems[Number(event.key) - 1])
        return
      }
      if (event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return
      if (target?.closest('button, a, [role="checkbox"]')) return

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

      if (event.key === ' ' && !isSearch && keyboardActiveId !== null) {
        const item = historyItems.find((entry) => entry.id === keyboardActiveId)
        if (item?.type === 'text') { event.preventDefault(); openEditor(item) }
        return
      }

      if (event.key === 'Enter') {
        event.preventDefault()
        await copyItem(historyItems.find((item) => item.id === keyboardActiveId) || historyItems[0])
      }
    }

    const clearKeyboardSelection = () => setKeyboardActiveId(null)
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('blur', clearKeyboardSelection)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('blur', clearKeyboardSelection)
    }
  }, [currentPage, historyItems, keyboardActiveId, selectionMode, historyLoading, setKeyboardActiveId, editCopyItems, confirmDeleteId, confirmClearAll, confirmBatchDelete, openEditor, showToast, t])

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

        <QueueBar />
        {/* Content */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {(currentPage === 'all' || currentPage === 'favorites') && <HistoryList onCopy={showToast} onEdit={openEditor} onMerge={setEditCopyItems} onTemplate={setTemplateItem} onOcr={setOcrItem} />}
          {currentPage === 'templates' && <TemplatesPanel onCopied={showToast} />}
          {currentPage === 'emoji' && <EmojiPicker onCopy={showToast} />}
          {currentPage === 'stickers' && <StickerGrid onCopy={showToast} />}
          {currentPage === 'devices' && <DevicesPanel />}
          {currentPage === 'settings' && <SettingsPanel />}
        </div>

      </div>

      {templateItem && <TemplateEditor body={templateItem.content || ''} onClose={() => setTemplateItem(null)} onSaved={() => showToast(language === 'en' ? 'Template saved' : '模板已保存')} />}
      {ocrItem && <OcrDialog item={ocrItem} onClose={() => setOcrItem(null)} onCopied={showToast} />}
      {/* Toast notification */}
      {toast && <Toast key={toastKey} message={toast.message} type={toast.type} onClose={clearToast} />}

      {/* Confirm dialogs */}
      {confirmDeleteId !== null && <ConfirmDialog type="delete" />}
      {confirmClearAll && <ConfirmDialog type="clearAll" />}
      {confirmBatchDelete && <ConfirmDialog type="batchDelete" />}
      {editCopyItems && (
        <EditCopyDialog
          key={editCopyItems.map((item) => item.id).join(',')}
          items={editCopyItems}
          onClose={() => setEditCopyItems(null)}
          onCopied={showToast}
        />
      )}
    </Layout>
  )
}
