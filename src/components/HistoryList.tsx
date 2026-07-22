import { useStore } from '../stores/useStore'
import HistoryCard from './HistoryCard'

interface HistoryListProps {
  onCopy: (msg: string) => void
}

export default function HistoryList({ onCopy }: HistoryListProps) {
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

  const allSelected = historyItems.length > 0 && selectedIds.size === historyItems.length

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

  if (historyItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500 py-20">
        <span className="text-4xl mb-3">
          {currentPage === 'favorites' ? '⭐' : '📋'}
        </span>
        <p className="text-sm">
          {searchQuery
            ? '没有匹配的记录'
            : currentPage === 'favorites'
            ? '还没有收藏任何记录'
            : '还没有复制记录，试试复制一些内容吧'}
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Batch action bar */}
      {selectionMode && (
        <div className="no-drag flex items-center justify-between px-4 py-2 bg-primary-50 dark:bg-primary-900/20 border-b border-primary-100 dark:border-gray-700 shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={handleSelectAll}
              className="text-xs text-primary-600 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-300 font-medium"
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
              className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 px-2 py-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
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
              className={`text-xs px-3 py-1 rounded-md font-medium transition-colors ${
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

      {/* Card list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {historyItems.map((item) => (
          <HistoryCard key={item.id} item={item} onCopy={onCopy} />
        ))}

        {!selectionMode && (
          <div className="pt-2 text-center flex gap-4 justify-center">
            <button
              onClick={handleToggleSelectionMode}
              className="no-drag text-xs text-primary-400 dark:text-primary-500 hover:text-primary-600 dark:hover:text-primary-300 transition-colors py-2 px-4"
            >
              批量管理
            </button>
            <button
              onClick={() => setConfirmClearAll(true)}
              className="no-drag text-xs text-gray-400 dark:text-gray-500 hover:text-red-400 dark:hover:text-red-400 transition-colors py-2 px-4"
            >
              清空全部记录
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
