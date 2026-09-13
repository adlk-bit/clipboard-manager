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
import type { QuickPasteStatus } from '../shared/quick-paste'

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
  const [quick, setQuick] = useState<QuickPasteStatus | null>(null)
  const [quickNotice, setQuickNotice] = useState('')
  const openEditor = useCallback((item: HistoryItem) => setEditCopyItems([item]), [])

  const showToast = useCallback((message: string, type: 'success' | 'info' = 'success') => {
    setToastKey(k => k + 1)
    setToast({ id: Date.now(), message, type })
  }, [])

  const clearToast = useCallback(() => {
    setToast(null)
  }, [])

  useEffect(() => {
    let revision = 0
    let openedSession = -1
    const receive = (value: QuickPasteStatus) => {
      setQuick(value)
      if (value.active && value.session !== openedSession) {
        openedSession = value.session
        if (document.querySelector('[role="dialog"]')) {
          void window.api.cancelQuickPaste()
          return
        }
        setQuickNotice('')
        const state = useStore.getState()
        state.setCurrentPage('all')
        requestAnimationFrame(() => document.getElementById('history-search')?.focus())
      }
    }
    const unsubscribe = window.api.onQuickPasteChanged((value) => { revision++; receive(value) })
    void window.api.getQuickPasteStatus().then((value) => { if (revision === 0) receive(value) })
    return unsubscribe
  }, [])

  useEffect(() => {
    if (quick?.active && (selectionMode || (currentPage !== 'all' && currentPage !== 'favorites'))) void window.api.cancelQuickPaste()
  }, [currentPage, selectionMode, quick?.active])

  const pasteItem = useCallback(async (item: HistoryItem | undefined) => {
    if (!item || !quick?.active || quick.busy || copyingRef.current) return
    if (item.type !== 'text') {
      setQuickNotice(language === 'en' ? 'Images support copy only. Use Ctrl+Enter or the copy button.' : '图片请使用 Ctrl+Enter 或复制按钮，仅文字支持直接粘贴。')
      return
    }
    copyingRef.current = true
    try {
      const result = await window.api.quickPaste(item.id, quick.session)
      if (!result.success) setQuickNotice(result.copied
        ? (language === 'en' ? 'Text copied. Paste could not be confirmed; check the destination before pasting manually.' : '文字已复制，未能确认粘贴完成；请先检查目标内容，再手动粘贴。')
        : (language === 'en' ? 'Paste not completed. Reopen the panel or use the copy button.' : '粘贴未完成，请重新唤起面板或使用复制按钮。'))
    } catch {
      setQuickNotice(language === 'en' ? 'Paste result unknown. Check the destination before trying again.' : '粘贴结果未知，请检查目标内容后再操作。')
    } finally { copyingRef.current = false }
  }, [quick, language])

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
        if (quick?.active) { await window.api.hideWindow(); return }
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
      if (event.key === 'Enter' && event.ctrlKey && !event.altKey && !event.shiftKey && !event.metaKey) {
        event.preventDefault()
        await copyItem(historyItems.find((item) => item.id === keyboardActiveId) || historyItems[0])
        return
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
        const item = historyItems.find((item) => item.id === keyboardActiveId) || historyItems[0]
        if (quick?.active) { if (!event.repeat) await pasteItem(item) }
        else await copyItem(item)
      }
    }

    const clearKeyboardSelection = () => setKeyboardActiveId(null)
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('blur', clearKeyboardSelection)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('blur', clearKeyboardSelection)
    }
  }, [currentPage, historyItems, keyboardActiveId, selectionMode, historyLoading, setKeyboardActiveId, editCopyItems, confirmDeleteId, confirmClearAll, confirmBatchDelete, openEditor, showToast, t, quick, pasteItem])

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
        {(quick?.active || quick?.busy || quickNotice) && <section aria-label={language === 'en' ? 'Quick paste' : '快捷粘贴'} className="no-drag shrink-0 space-y-1 border-b border-primary-200 bg-primary-50 p-2 text-xs dark:border-primary-900 dark:bg-primary-900/20 dark:text-gray-100">
          {(quick?.active || quick?.busy) && <>
            <p className="truncate font-medium">{language === 'en' ? 'Paste to: ' : '粘贴到：'}{quick.target || (language === 'en' ? 'Copy only (target unavailable)' : '仅复制（目标不可用）')}</p>
            <p className="text-[10px]">{language === 'en' ? 'Enter: paste · Ctrl+Enter: copy only · Esc: cancel' : 'Enter 粘贴 · Ctrl+Enter 仅复制 · Esc 取消'}</p>
            <div className="flex gap-2">
              <button type="button" disabled={quick.busy || historyLoading || !historyItems.length} className="rounded bg-primary-500 px-2 py-1 text-white disabled:opacity-40" onClick={() => void pasteItem(historyItems.find((item) => item.id === keyboardActiveId) || historyItems[0])}>{quick.busy ? (language === 'en' ? 'Pasting…' : '正在粘贴…') : (language === 'en' ? 'Paste selected' : '粘贴选中记录')}</button>
              <button type="button" disabled={quick.busy} onClick={() => void window.api.hideWindow()}>{language === 'en' ? 'Cancel' : '取消'}</button>
            </div>
          </>}
          {quickNotice && <p role="alert" className="text-[11px]">{quickNotice}<button type="button" className="ml-2 underline" onClick={() => setQuickNotice('')}>{language === 'en' ? 'Dismiss' : '关闭提示'}</button></p>}
        </section>}
        {/* Content */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {(currentPage === 'all' || currentPage === 'favorites') && <HistoryList quickPasteActive={quick?.active} onCopy={showToast} onEdit={openEditor} onMerge={setEditCopyItems} onTemplate={setTemplateItem} onOcr={setOcrItem} />}
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
