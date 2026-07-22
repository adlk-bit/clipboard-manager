import { useState } from 'react'
import { useStore } from '../stores/useStore'

export default function ExportImport() {
  const [message, setMessage] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const loadHistory = useStore((s) => s.loadHistory)

  const handleExport = async () => {
    try {
      const filePath = await window.api.exportHistory()
      if (filePath) {
        setMessage(`已导出到 ${filePath}`)
        setTimeout(() => setMessage(null), 3000)
      }
    } catch (e) {
      setMessage('导出失败')
      setTimeout(() => setMessage(null), 3000)
    }
  }

  const handleImport = async () => {
    setImporting(true)
    try {
      const count = await window.api.importHistory()
      if (count > 0) {
        setMessage(`成功导入 ${count} 条记录`)
        await loadHistory()
      } else {
        setMessage('未导入任何记录')
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
          className="no-drag flex-1 py-2.5 px-4 rounded-xl bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 text-sm font-medium hover:bg-primary-100 dark:hover:bg-primary-900/40 transition-colors"
        >
          📤 导出数据
        </button>
        <button
          onClick={handleImport}
          disabled={importing}
          className="no-drag flex-1 py-2.5 px-4 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
        >
          📥 导入数据
        </button>
      </div>

      {message && (
        <div className="mt-2 py-2 px-3 rounded-lg bg-primary-50 dark:bg-primary-900/20 text-xs text-primary-600 dark:text-primary-400 text-center">
          {message}
        </div>
      )}
    </div>
  )
}
