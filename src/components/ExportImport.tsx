import { useState } from 'react'
import { useStore } from '../stores/useStore'
import Icon from './Icon'

export default function ExportImport() {
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
        const skipped = result.skippedFiles > 0 ? `，跳过 ${result.skippedFiles} 个缺失文件` : ''
        setMessage(`已备份 ${result.historyCount} 条记录和 ${result.stickerCount} 张贴图${skipped}`)
      }
    } catch (e) {
      setMessage('导出失败')
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
        const mode = result.mode === 'replace' ? '覆盖恢复' : '合并导入'
        const skipped = result.skippedItems + result.skippedDuplicates
        setMessage(`${mode}完成：${result.historyCount} 条记录、${result.stickerCount} 张贴图${skipped > 0 ? `，跳过 ${skipped} 项` : ''}`)
        await Promise.all([loadHistory(), loadStickers(), loadSettings()])
      } else if (result.status === 'error') {
        setMessage(`导入失败：${result.error}`)
      }
    } catch (e) {
      setMessage('导入失败，请检查文件格式')
    } finally {
      setImporting(false)
      setTimeout(() => setMessage(null), 3000)
    }
  }

  return (
    <div>
      <h3 className="mb-1.5 text-xs font-semibold text-gray-700 dark:text-gray-200">数据管理</h3>
      <div className="flex gap-1.5">
        <button
          onClick={handleExport}
          disabled={exporting || importing}
          className="no-drag flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md bg-primary-50 px-3 text-xs font-medium text-primary-600 transition-colors hover:bg-primary-100 disabled:opacity-50 dark:bg-primary-900/20 dark:text-primary-400 dark:hover:bg-primary-900/40"
        >
          {!exporting && <Icon name="upload" size={14} />}
          {exporting ? '正在备份…' : '完整备份'}
        </button>
        <button
          onClick={handleImport}
          disabled={importing || exporting}
          className="no-drag flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md bg-gray-100 px-3 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-200 disabled:opacity-50 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          {!importing && <Icon name="download" size={14} />}
          {importing ? '正在导入…' : '恢复备份'}
        </button>
      </div>
      <p className="mt-1.5 text-[10px] leading-4 text-gray-400 dark:text-gray-500">
        .clipbackup 会包含历史文字、图片、贴图库、收藏整理信息和安全设置；也兼容导入旧版 JSON。
      </p>

      {message && (
        <div className="mt-1.5 rounded-md bg-primary-50 px-3 py-1.5 text-center text-[11px] text-primary-600 dark:bg-primary-900/20 dark:text-primary-400">
          {message}
        </div>
      )}
    </div>
  )
}
