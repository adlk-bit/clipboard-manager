import { useState } from 'react'
import { useStore } from '../stores/useStore'

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
      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">数据管理</h3>
      <div className="flex gap-2">
        <button
          onClick={handleExport}
          disabled={exporting || importing}
          className="no-drag flex-1 py-2.5 px-4 rounded-xl bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 text-sm font-medium hover:bg-primary-100 dark:hover:bg-primary-900/40 transition-colors"
        >
          {exporting ? '正在备份…' : '📤 完整备份'}
        </button>
        <button
          onClick={handleImport}
          disabled={importing || exporting}
          className="no-drag flex-1 py-2.5 px-4 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
        >
          {importing ? '正在导入…' : '📥 恢复备份'}
        </button>
      </div>
      <p className="mt-2 text-[10px] leading-4 text-gray-400 dark:text-gray-500">
        .clipbackup 会包含历史文字、图片、贴图库、收藏整理信息和安全设置；也兼容导入旧版 JSON。
      </p>

      {message && (
        <div className="mt-2 py-2 px-3 rounded-lg bg-primary-50 dark:bg-primary-900/20 text-xs text-primary-600 dark:text-primary-400 text-center">
          {message}
        </div>
      )}
    </div>
  )
}
