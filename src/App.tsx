import { useEffect, useState, useCallback } from 'react'
import Layout from './components/Layout'
import Sidebar from './components/Sidebar'
import HistoryList from './components/HistoryList'
import SearchBar from './components/SearchBar'
import StickerGrid from './components/StickerGrid'
import SettingsPanel from './components/SettingsPanel'
import ConfirmDialog from './components/ConfirmDialog'
import Toast from './components/Toast'
import { useStore } from './stores/useStore'

export default function App() {
  const currentPage = useStore((s) => s.currentPage)
  const loadHistory = useStore((s) => s.loadHistory)
  const confirmDeleteId = useStore((s) => s.confirmDeleteId)
  const confirmClearAll = useStore((s) => s.confirmClearAll)

  const [toast, setToast] = useState<{ id: number; message: string; type: 'success' | 'info' } | null>(null)
  const [toastKey, setToastKey] = useState(0)

  const showToast = useCallback((message: string, type: 'success' | 'info' = 'success') => {
    setToastKey(k => k + 1)
    setToast({ id: toastKey, message, type })
  }, [toastKey])

  const clearToast = useCallback(() => {
    setToast(null)
  }, [])

  useEffect(() => {
    loadHistory()
  }, [])

  return (
    <Layout>
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0 bg-white">
        {/* Header */}
        <div className="drag-region flex items-center justify-between px-4 py-3 border-b border-primary-100 shrink-0">
          <h1 className="text-sm font-semibold text-primary-800 no-drag">
            {currentPage === 'all' && '剪贴板历史'}
            {currentPage === 'favorites' && '收藏记录'}
            {currentPage === 'stickers' && '贴图库'}
            {currentPage === 'settings' && '设置'}
          </h1>
          {(currentPage === 'all' || currentPage === 'favorites') && (
            <div className="no-drag">
              <SearchBar />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {(currentPage === 'all' || currentPage === 'favorites') && <HistoryList onCopy={showToast} />}
          {currentPage === 'stickers' && <StickerGrid onCopy={showToast} />}
          {currentPage === 'settings' && <SettingsPanel />}
        </div>

        {/* Status bar */}
        <div className="px-4 py-1.5 border-t border-primary-100 bg-primary-50 text-xs text-primary-600 shrink-0">
          {currentPage === 'all' && <span>自动记录中 · 点击卡片右侧 📋 图标复制 · 按 Ctrl+Shift+V 唤起窗口</span>}
          {currentPage === 'favorites' && <span>收藏的记录不受过期清理影响</span>}
          {currentPage === 'stickers' && <span>点击贴图即可复制到剪贴板</span>}
          {currentPage === 'settings' && <span>修改设置后自动保存</span>}
        </div>
      </div>

      {/* Toast notification */}
      {toast && <Toast key={toastKey} message={toast.message} type={toast.type} onClose={clearToast} />}

      {/* Confirm dialogs */}
      {confirmDeleteId !== null && <ConfirmDialog type="delete" />}
      {confirmClearAll && <ConfirmDialog type="clearAll" />}
    </Layout>
  )
}
