import { useState } from 'react'
import SourceFilter from './SourceFilter'
import { useWords, errorText } from './ProductivityShared'
import { useStore } from '../stores/useStore'
import type { HistoryItem } from '../types'
import HistoryCard from './HistoryCard'
import Icon from './Icon'
import { useI18n } from '../lib/i18n'
import type { HistoryContentType } from '../../shared/history-query'

interface HistoryListProps {
  quickPasteActive?: boolean
  onCopy: (msg: string) => void
  onEdit: (item: HistoryItem) => void
  onTemplate: (item: HistoryItem) => void
  onOcr: (item: HistoryItem) => void
  onMerge: (items: HistoryItem[]) => void
}

export default function HistoryList({ onCopy, onEdit, onMerge, onTemplate, onOcr, quickPasteActive = false }: HistoryListProps) {
  const { t, language } = useI18n()
  const q = useWords()
  const [queueError, setQueueError] = useState('')
  const [queueBusy, setQueueBusy] = useState(false)
  const [reverseQueue, setReverseQueue] = useState(false)
  const historyItems = useStore((s) => s.historyItems)
  const historyLoading = useStore((s) => s.historyLoading)
  const historyError = useStore((s) => s.historyError)
  const loadHistory = useStore((s) => s.loadHistory)
  const contentType = useStore((s) => s.contentType)
  const setContentType = useStore((s) => s.setContentType)
  const setConfirmClearAll = useStore((s) => s.setConfirmClearAll)
  const currentPage = useStore((s) => s.currentPage)
  const searchQuery = useStore((s) => s.searchQuery)
  const selectionMode = useStore((s) => s.selectionMode)
  const setSelectionMode = useStore((s) => s.setSelectionMode)
  const selectedIds = useStore((s) => s.selectedIds)
  const selectAll = useStore((s) => s.selectAll)
  const clearSelection = useStore((s) => s.clearSelection)
  const setConfirmBatchDelete = useStore((s) => s.setConfirmBatchDelete)
  const favoriteFolder = useStore((s) => s.favoriteFolder)
  const favoriteFolders = useStore((s) => s.favoriteFolders)
  const setFavoriteFolder = useStore((s) => s.setFavoriteFolder)
  const historySort = useStore((s) => s.historySort)
  const setHistorySort = useStore((s) => s.setHistorySort)
  const monitorPaused = useStore((s) => s.monitorPaused)

  const allSelected = historyItems.length > 0 && selectedIds.size === historyItems.length
  const pinnedFavorites = currentPage === 'favorites' ? historyItems.filter((item) => item.is_pinned) : []
  const regularItems = currentPage === 'favorites' ? historyItems.filter((item) => !item.is_pinned) : historyItems
  const selectedItems = selectionMode ? historyItems.filter((item) => selectedIds.has(item.id)) : []
  const canMerge = selectedItems.length >= 2 && selectedItems.every((item) => item.type === 'text' && item.content !== null)

  const handleToggleSelectionMode = () => {
    if (selectionMode) {
      clearSelection()
      setSelectionMode(false)
    } else {
      setSelectionMode(true)
    }
  }

  const handleSelectAll = () => {
    if (allSelected) {
      clearSelection()
    } else {
      selectAll()
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Batch action bar */}
      {selectionMode && (
        <div className="no-drag flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-primary-200 bg-primary-50 px-3 py-2 dark:border-primary-900 dark:bg-primary-900/30">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" disabled={queueBusy || historyLoading || !selectedItems.length || selectedItems.length > 100 || selectedItems.some((item) => item.type !== 'text')} className="rounded bg-primary-500 px-2 py-1 text-xs text-white disabled:opacity-40" onClick={async () => {
              setQueueBusy(true); setQueueError('')
              try { await window.api.startQueue((reverseQueue ? [...selectedItems].reverse() : selectedItems).map((item) => item.id)); setSelectionMode(false) }
              catch (error) { setQueueError(errorText(error, language === 'en')) } finally { setQueueBusy(false) }
            }}>{q('顺序粘贴', 'Paste queue')}</button>
            <label className="text-[10px] dark:text-gray-300"><input type="checkbox" checked={reverseQueue} onChange={(event) => setReverseQueue(event.target.checked)} /> {q('倒序', 'Reverse')}</label>
            <span className="w-full text-[10px] text-gray-500 dark:text-gray-400">{q('按列表顺序，最多 100 条文字', 'List order, up to 100 text items')}</span>
            <button type="button" disabled={!canMerge || historyLoading} title={t('history.mergeHint')} onClick={() => onMerge(selectedItems)} className="rounded bg-primary-500 px-2 py-1 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-40">{t('history.merge')}</button>
            <button
              onClick={handleSelectAll}
              className="text-xs font-medium text-primary-600 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-300"
            >
              {allSelected ? t('history.deselectAll') : t('history.selectAll')}
            </button>
            <span className="text-xs text-primary-400 dark:text-primary-500">
              {t('history.selected', { count: selectedIds.size })}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                clearSelection()
                setSelectionMode(false)
              }}
              className="rounded px-2 py-1 text-xs text-gray-500 hover:bg-black/[0.05] hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-gray-200"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={() => {
                if (selectedIds.size > 0) {
                  setConfirmBatchDelete(true)
                }
              }}
              disabled={selectedIds.size === 0}
              className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                selectedIds.size > 0
                  ? 'bg-red-500 text-white hover:bg-red-600'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
              }`}
            >
              {t('history.deleteSelected')}
            </button>
          </div>
        </div>
      )}

      {!selectionMode && (
        <div className="history-filters no-drag">
          <div className="filter-row">
            <div className="type-tabs" role="group" aria-label={t('history.types')}>
              {(['all', 'text', 'url', 'image'] as HistoryContentType[]).map((type) => (
                <button key={type} type="button" aria-pressed={contentType === type} onClick={() => setContentType(type)}>
                  {t(`history.type.${type}`)}
                </button>
              ))}
            </div>
            <button type="button" className="manage-button" onClick={handleToggleSelectionMode} disabled={historyItems.length === 0 || historyLoading}>{t('history.batchManage')}</button>
          </div>
          <div className="filter-row filter-secondary">
            {currentPage === 'all' && (
              <div className="sort-options" role="group" aria-label={q('排列顺序', 'Sort order')}>
                {(['recent', 'frequent'] as const).map(sort => (
                  <button key={sort} type="button" aria-pressed={historySort === sort} onClick={() => setHistorySort(sort)}>{t(`history.${sort}`)}</button>
                ))}
              </div>
            )}
            <SourceFilter />
          </div>
        </div>
      )}
      {queueError && <p role="alert" className="p-2 text-xs text-red-500">{queueError}</p>}
      {/* Card list */}
      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-2.5" aria-busy={historyLoading}>
        {historyError && <button type="button" onClick={() => void loadHistory()} className="w-full rounded p-2 text-xs text-red-500">{t('history.retry')}</button>}
        {historyItems.length === 0 && !historyError && (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-gray-500">
            <div className="mb-3 flex size-10 items-center justify-center rounded-xl bg-black/[0.04] dark:bg-white/[0.06]">
              <Icon name={currentPage === 'favorites' ? 'star' : 'clipboard'} size={20} />
            </div>
            <p className="max-w-[240px] text-center text-xs leading-5">
              {historyLoading ? t('history.loading') : searchQuery || contentType !== 'all'
                ? t('history.emptySearch')
                : currentPage === 'favorites'
                ? t('history.emptyFavorites')
                : monitorPaused
                ? t('history.emptyPaused')
                : t('history.empty')}
            </p>
          </div>
        )}
        {currentPage === 'favorites' && !selectionMode && (
          <div className="no-drag flex gap-1 overflow-x-auto pb-1">
            <button onClick={() => setFavoriteFolder('')} className={`shrink-0 rounded px-2 py-1 text-[10px] ${favoriteFolder === '' ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300'}`}>{t('history.all')}</button>
            {favoriteFolders.map((folder) => (
              <button key={folder} onClick={() => setFavoriteFolder(folder)} className={`shrink-0 rounded px-2 py-1 text-[10px] ${favoriteFolder === folder ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300'}`}>{folder}</button>
            ))}
          </div>
        )}

        {pinnedFavorites.length > 0 && (
          <div className="pt-1 text-[10px] font-medium text-primary-500 dark:text-primary-400">{t('history.pinnedFavorites')}</div>
        )}
        {pinnedFavorites.map((item) => (
          <HistoryCard key={item.id} item={item} onCopy={onCopy} onEdit={onEdit} onTemplate={onTemplate} onOcr={onOcr} />
        ))}
        {pinnedFavorites.length > 0 && regularItems.length > 0 && (
          <div className="pt-2 text-[10px] font-medium text-gray-400 dark:text-gray-500">{t('history.allFavorites')}</div>
        )}
        {regularItems.map((item) => (
          <HistoryCard key={item.id} item={item} onCopy={onCopy} onEdit={onEdit} onTemplate={onTemplate} onOcr={onOcr} />
        ))}

        {!selectionMode && historyItems.length > 0 && (
          <div className="flex justify-center gap-3 pt-1 text-center">
            <button
              onClick={() => setConfirmClearAll(true)}
              className="no-drag rounded px-2 py-1.5 text-[11px] text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:text-gray-500 dark:hover:bg-red-900/20 dark:hover:text-red-400"
            >
              {t('history.clearAll')}
            </button>
          </div>
        )}
      </div>
      {!selectionMode && <div className="history-keys" title={t('history.keyboardMore')}>{quickPasteActive ? q('↑↓ 选择 · Enter 粘贴 · Ctrl+Enter 仅复制', '↑↓ Select · Enter Paste · Ctrl+Enter Copy only') : t('history.keyboard')}</div>}
    </div>
  )
}
