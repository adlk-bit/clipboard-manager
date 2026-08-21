import { useStore } from '../stores/useStore'
import Icon from './Icon'
import { useI18n } from '../lib/i18n'

interface ConfirmDialogProps {
  type: 'delete' | 'clearAll' | 'batchDelete'
}

export default function ConfirmDialog({ type }: ConfirmDialogProps) {
  const { t } = useI18n()
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
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/35 dark:bg-black/60" onClick={handleCancel}>
      <div
        role="dialog"
        aria-modal="true"
        className="no-drag mx-4 w-full max-w-[280px] rounded-xl border border-[#dedee3] bg-white p-4 shadow-xl dark:border-white/10 dark:bg-[#2c2c2f]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 text-center">
          <div className="mx-auto mb-2 flex size-9 items-center justify-center rounded-full bg-red-50 text-red-500 dark:bg-red-900/20 dark:text-red-400">
            <Icon name={type === 'clearAll' ? 'warning' : 'trash'} size={18} />
          </div>
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
            {type === 'delete' ? t('confirm.deleteTitle') : type === 'batchDelete' ? t('confirm.batchTitle', { count: selectedIds.size }) : t('confirm.clearTitle')}
          </h3>
          <p className="mt-1 text-[11px] leading-4 text-gray-400 dark:text-gray-500">
            {type === 'delete'
              ? t('confirm.deleteDetail')
              : type === 'batchDelete'
              ? t('confirm.batchDetail', { count: selectedIds.size })
              : t('confirm.clearDetail')}
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleCancel}
            className="h-8 flex-1 rounded-md bg-gray-100 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleConfirm}
            className="h-8 flex-1 rounded-md bg-red-500 text-xs font-medium text-white transition-colors hover:bg-red-600"
          >
            {type === 'clearAll' ? t('confirm.clear') : t('common.delete')}
          </button>
        </div>
      </div>
    </div>
  )
}
