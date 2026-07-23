import { useStore } from '../stores/useStore'

interface ConfirmDialogProps {
  type: 'delete' | 'clearAll' | 'batchDelete'
}

export default function ConfirmDialog({ type }: ConfirmDialogProps) {
  const confirmDeleteId = useStore((s) => s.confirmDeleteId)
  const setConfirmDeleteId = useStore((s) => s.setConfirmDeleteId)
  const setConfirmClearAll = useStore((s) => s.setConfirmClearAll)
  const setConfirmBatchDelete = useStore((s) => s.setConfirmBatchDelete)
  const selectedIds = useStore((s) => s.selectedIds)
  const batchDelete = useStore((s) => s.batchDelete)
  const loadHistory = useStore((s) => s.loadHistory)
  const searchQuery = useStore((s) => s.searchQuery)
  const currentPage = useStore((s) => s.currentPage)

  const handleConfirm = async () => {
    if (type === 'delete' && confirmDeleteId !== null) {
      await window.api.deleteHistory(confirmDeleteId)
      setConfirmDeleteId(null)
    } else if (type === 'clearAll') {
      await window.api.clearAllHistory()
      setConfirmClearAll(false)
    } else if (type === 'batchDelete') {
      await batchDelete()
      setConfirmBatchDelete(false)
    }
    const filter = currentPage === 'favorites' ? 'favorites' : 'all'
    await loadHistory(searchQuery, filter)
  }

  const handleCancel = () => {
    if (type === 'delete') {
      setConfirmDeleteId(null)
    } else if (type === 'batchDelete') {
      setConfirmBatchDelete(false)
    } else {
      setConfirmClearAll(false)
    }
  }

  return (
    <div className="absolute inset-0 bg-black/25 dark:bg-black/55 flex items-center justify-center z-50" onClick={handleCancel}>
      <div
        className="no-drag bg-white/95 dark:bg-[#2c2c2e]/95 rounded-[18px] p-5 mx-4 shadow-[0_18px_42px_rgba(0,0,0,0.24)] border border-white/80 dark:border-white/10 max-w-xs w-full backdrop-blur-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center mb-4">
          <span className="text-3xl">
            {type === 'delete' ? '🗑️' : type === 'batchDelete' ? '🗑️' : '⚠️'}
          </span>
          <h3 className="text-sm font-medium text-gray-800 dark:text-gray-100 mt-2">
            {type === 'delete' ? '确认删除这条记录？' : type === 'batchDelete' ? `确认删除 ${selectedIds.size} 条记录？` : '确认清空全部记录？'}
          </h3>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            {type === 'delete'
              ? '删除后无法恢复'
              : type === 'batchDelete'
              ? `将删除选中的 ${selectedIds.size} 条记录，此操作无法恢复`
              : '此操作将删除所有历史记录（不包括贴图），无法恢复'}
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleCancel}
            className="flex-1 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 py-2 rounded-lg text-white text-sm font-medium bg-red-500 hover:bg-red-600 transition-colors"
          >
            {type === 'delete' ? '删除' : type === 'batchDelete' ? '删除' : '清空全部'}
          </button>
        </div>
      </div>
    </div>
  )
}
