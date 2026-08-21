import { useState } from 'react'
import { useStore } from '../stores/useStore'
import Icon from './Icon'
import { useI18n } from '../lib/i18n'

export default function ExportImport() {
  const { t } = useI18n()
  const [message, setMessage] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [exporting, setExporting] = useState(false)
  const loadHistory = useStore((s) => s.loadHistory)
  const loadStickers = useStore((s) => s.loadStickers)
  const loadSettings = useStore((s) => s.loadSettings)

  const handleExport = async () => {
    setExporting(true)
    try {
      const result = await window.api.exportHistory()
      if (result) {
        const skipped = result.skippedFiles > 0 ? t('backup.skippedFiles', { count: result.skippedFiles }) : ''
        setMessage(t('backup.exported', { history: result.historyCount, stickers: result.stickerCount, skipped }))
      }
    } catch (e) {
      setMessage(t('backup.exportFailed'))
    } finally {
      setExporting(false)
      setTimeout(() => setMessage(null), 3000)
    }
  }

  const handleImport = async () => {
    setImporting(true)
    try {
      const result = await window.api.importHistory()
      if (result.status === 'success') {
        const mode = result.mode === 'replace' ? t('backup.replace') : t('backup.merge')
        const skipped = result.skippedItems + result.skippedDuplicates
        setMessage(t('backup.imported', { mode, history: result.historyCount, stickers: result.stickerCount, skipped: skipped > 0 ? t('backup.skippedItems', { count: skipped }) : '' }))
        await Promise.all([loadHistory(), loadStickers(), loadSettings()])
      } else if (result.status === 'error') {
        setMessage(t('backup.importFailed', { error: result.error }))
      }
    } catch (e) {
      setMessage(t('backup.invalid'))
    } finally {
      setImporting(false)
      setTimeout(() => setMessage(null), 3000)
    }
  }

  return (
    <div>
      <h3 className="mb-1.5 text-xs font-semibold text-gray-700 dark:text-gray-200">{t('backup.title')}</h3>
      <div className="flex gap-1.5">
        <button
          onClick={handleExport}
          disabled={exporting || importing}
          className="no-drag flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md bg-primary-50 px-3 text-xs font-medium text-primary-600 transition-colors hover:bg-primary-100 disabled:opacity-50 dark:bg-primary-900/20 dark:text-primary-400 dark:hover:bg-primary-900/40"
        >
          {!exporting && <Icon name="upload" size={14} />}
          {exporting ? t('backup.exporting') : t('backup.export')}
        </button>
        <button
          onClick={handleImport}
          disabled={importing || exporting}
          className="no-drag flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md bg-gray-100 px-3 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-200 disabled:opacity-50 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          {!importing && <Icon name="download" size={14} />}
          {importing ? t('backup.importing') : t('backup.import')}
        </button>
      </div>
      <p className="mt-1.5 text-[10px] leading-4 text-gray-400 dark:text-gray-500">
        {t('backup.description')}
      </p>

      {message && (
        <div className="mt-1.5 rounded-md bg-primary-50 px-3 py-1.5 text-center text-[11px] text-primary-600 dark:bg-primary-900/20 dark:text-primary-400">
          {message}
        </div>
      )}
    </div>
  )
}
