import { useStore } from '../stores/useStore'

interface ConfirmDialogProps {
  type: 'delete' | 'clearAll'
}

export default function ConfirmDialog({ type }: ConfirmDialogProps) {
  const confirmDeleteId = useStore((s) => s.confirmDeleteId)
  const setConfirmDeleteId = useStore((s) => s.setConfirmDeleteId)
  const setConfirmClearAll = useStore((s) => s.setConfirmClearAll)
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
    }
    const filter = currentPage === 'favorites' ? 'favorites' : 'all'
    await loadHistory(searchQuery, filter)
  }

  const handleCancel = () => {
    if (type === 'delete') {
      setConfirmDeleteId(null)
    } else {
      setConfirmClearAll(false)
    }
  }

  return (
    <div className="absolute inset-0 bg-black/20 flex items-center justify-center z-50" onClick={handleCancel}>
      <div
        className="no-drag bg-white rounded-xl p-5 mx-4 shadow-xl border border-gray-100 max-w-xs w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center mb-4">
          <span className="text-3xl">
            {type === 'delete' ? '🗑️' : '⚠️'}
          </span>
          <h3 className="text-sm font-medium text-gray-800 mt-2">
            {type === 'delete' ? '确认删除这条记录？' : '确认清空全部记录？'}
          </h3>
          <p className="text-xs text-gray-400 mt-1">
            {type === 'delete'
              ? '删除后无法恢复'
              : '此操作将删除所有历史记录（不包括贴图），无法恢复'}
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleCancel}
            className="flex-1 py-2 rounded-lg bg-gray-100 text-gray-600 text-sm font-medium hover:bg-gray-200 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleConfirm}
            className={`flex-1 py-2 rounded-lg text-white text-sm font-medium transition-colors ${
              type === 'delete'
                ? 'bg-red-500 hover:bg-red-600'
                : 'bg-red-500 hover:bg-red-600'
            }`}
          >
            {type === 'delete' ? '删除' : '清空全部'}
          </button>
        </div>
      </div>
    </div>
  )
}
