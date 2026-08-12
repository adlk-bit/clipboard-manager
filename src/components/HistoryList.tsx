import { useStore } from '../stores/useStore'
import type { HistoryItem } from '../types'
import HistoryCard from './HistoryCard'
import Icon from './Icon'

interface HistoryListProps {
  onCopy: (msg: string) => void
  onEdit: (item: HistoryItem) => void
}

export default function HistoryList({ onCopy, onEdit }: HistoryListProps) {
  const historyItems = useStore((s) => s.historyItems)
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
  const toggleMonitorPaused = useStore((s) => s.toggleMonitorPaused)

  const allSelected = historyItems.length > 0 && selectedIds.size === historyItems.length
  const pinnedFavorites = currentPage === 'favorites' ? historyItems.filter((item) => item.is_pinned) : []
  const regularItems = currentPage === 'favorites' ? historyItems.filter((item) => !item.is_pinned) : historyItems

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
        <div className="no-drag flex h-10 shrink-0 items-center justify-between border-b border-[#bedcff] bg-[#edf6ff] px-3 dark:border-[#0a84ff]/25 dark:bg-[#0a84ff]/10">
          <div className="flex items-center gap-2">
            <button
              onClick={handleSelectAll}
              className="text-xs font-medium text-primary-600 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-300"
            >
              {allSelected ? '取消全选' : '全选'}
            </button>
            <span className="text-xs text-primary-400 dark:text-primary-500">
              已选 {selectedIds.size} 项
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
              取消
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
              删除选中
            </button>
          </div>
        </div>
      )}

      {currentPage === 'all' && !selectionMode && (
        <div className="no-drag flex h-10 shrink-0 items-center justify-between gap-2 border-b border-[#e6e6e9] px-3 dark:border-white/[0.07]">
          <div className="flex rounded-md bg-[#e9e9ec] p-0.5 dark:bg-white/[0.08]">
            <button
              onClick={() => setHistorySort('recent')}
              className={`rounded px-2.5 py-1 text-[10px] font-medium transition-colors ${historySort === 'recent' ? 'bg-white text-[#006bd6] shadow-sm dark:bg-white/10 dark:text-[#53a9ff]' : 'text-[#6b6b70] hover:text-[#29292d] dark:text-[#a6a6ab] dark:hover:text-white'}`}
            >
              最新
            </button>
            <button
              onClick={() => setHistorySort('frequent')}
              className={`rounded px-2.5 py-1 text-[10px] font-medium transition-colors ${historySort === 'frequent' ? 'bg-white text-[#006bd6] shadow-sm dark:bg-white/10 dark:text-[#53a9ff]' : 'text-[#6b6b70] hover:text-[#29292d] dark:text-[#a6a6ab] dark:hover:text-white'}`}
            >
              常用
            </button>
          </div>
          <button
            type="button"
            onClick={toggleMonitorPaused}
            aria-pressed={monitorPaused}
            title={monitorPaused ? '恢复自动记录' : '暂停自动记录'}
            className={`flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium transition-colors ${monitorPaused ? 'bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-500/20 dark:text-amber-300' : 'text-[#626267] hover:bg-black/[0.05] dark:text-[#aaaab0] dark:hover:bg-white/[0.08]'}`}
          >
            <Icon name={monitorPaused ? 'play' : 'pause'} size={12} />
            {monitorPaused ? '恢复记录' : '暂停记录'}
          </button>
        </div>
      )}

      {/* Card list */}
      <div className="flex-1 space-y-1.5 overflow-y-auto p-2.5">
        {historyItems.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-gray-500">
            <div className="mb-3 flex size-10 items-center justify-center rounded-xl bg-black/[0.04] dark:bg-white/[0.06]">
              <Icon name={currentPage === 'favorites' ? 'star' : 'clipboard'} size={20} />
            </div>
            <p className="max-w-[240px] text-center text-xs leading-5">
              {searchQuery
                ? '没有匹配的记录'
                : currentPage === 'favorites'
                ? '还没有收藏任何记录'
                : monitorPaused
                ? '记录已暂停，恢复后会继续收集新复制内容'
                : '还没有复制记录，试试复制一些内容吧'}
            </p>
          </div>
        )}
        {currentPage === 'favorites' && !selectionMode && (
          <div className="no-drag flex gap-1 overflow-x-auto pb-1">
            <button onClick={() => setFavoriteFolder('')} className={`shrink-0 rounded px-2 py-1 text-[10px] ${favoriteFolder === '' ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300'}`}>全部</button>
            {favoriteFolders.map((folder) => (
              <button key={folder} onClick={() => setFavoriteFolder(folder)} className={`shrink-0 rounded px-2 py-1 text-[10px] ${favoriteFolder === folder ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300'}`}>{folder}</button>
            ))}
          </div>
        )}

        {pinnedFavorites.length > 0 && (
          <div className="pt-1 text-[10px] font-medium text-primary-500 dark:text-primary-400">置顶收藏</div>
        )}
        {pinnedFavorites.map((item) => (
          <HistoryCard key={item.id} item={item} onCopy={onCopy} onEdit={onEdit} />
        ))}
        {pinnedFavorites.length > 0 && regularItems.length > 0 && (
          <div className="pt-2 text-[10px] font-medium text-gray-400 dark:text-gray-500">全部收藏</div>
        )}
        {regularItems.map((item) => (
          <HistoryCard key={item.id} item={item} onCopy={onCopy} onEdit={onEdit} />
        ))}

        {!selectionMode && historyItems.length > 0 && (
          <div className="flex justify-center gap-3 pt-1 text-center">
            <button
              onClick={handleToggleSelectionMode}
              className="no-drag rounded px-2 py-1.5 text-[11px] text-primary-500 transition-colors hover:bg-primary-50 hover:text-primary-700 dark:text-primary-400 dark:hover:bg-primary-900/20"
            >
              批量管理
            </button>
            <button
              onClick={() => setConfirmClearAll(true)}
              className="no-drag rounded px-2 py-1.5 text-[11px] text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:text-gray-500 dark:hover:bg-red-900/20 dark:hover:text-red-400"
            >
              清空全部记录
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
