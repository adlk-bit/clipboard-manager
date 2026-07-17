import { useEffect } from 'react'
import { useStore } from '../stores/useStore'
import ExportImport from './ExportImport'

export default function SettingsPanel() {
  const retentionDays = useStore((s) => s.retentionDays)
  const autoHide = useStore((s) => s.autoHide)
  const setRetentionDays = useStore((s) => s.setRetentionDays)
  const setAutoHide = useStore((s) => s.setAutoHide)
  const saveSettings = useStore((s) => s.saveSettings)
  const loadSettings = useStore((s) => s.loadSettings)

  useEffect(() => {
    loadSettings()
  }, [])

  const handleRetentionChange = (days: string) => {
    setRetentionDays(days)
    saveSettings('retention_days', days)
  }

  const handleAutoHideChange = (hide: boolean) => {
    setAutoHide(hide)
    saveSettings('auto_hide', hide ? 'true' : 'false')
  }

  return (
    <div className="p-4 space-y-5">
      {/* Retention */}
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-2">存储期限</h3>
        <p className="text-xs text-gray-400 mb-3">超过期限的记录将自动清理（置顶和收藏的记录不受影响）</p>
        <div className="grid grid-cols-4 gap-2">
          {[
            { value: '1', label: '1 天' },
            { value: '3', label: '3 天' },
            { value: '5', label: '5 天' },
            { value: '0', label: '永久' },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => handleRetentionChange(opt.value)}
              className={`no-drag py-2 px-3 rounded-lg text-xs font-medium transition-all ${
                retentionDays === opt.value
                  ? 'bg-primary-500 text-white shadow-sm'
                  : 'bg-gray-50 text-gray-600 hover:bg-primary-50 hover:text-primary-600'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Auto hide */}
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-2">窗口行为</h3>
        <label className="flex items-center justify-between py-3 px-4 rounded-xl bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors">
          <div>
            <p className="text-sm text-gray-700">失去焦点时自动隐藏</p>
            <p className="text-[10px] text-gray-400 mt-0.5">点击窗口外部时自动隐藏窗口到托盘</p>
          </div>
          <button
            onClick={() => handleAutoHideChange(!autoHide)}
            className={`no-drag relative w-10 h-5 rounded-full transition-colors ${
              autoHide ? 'bg-primary-500' : 'bg-gray-300'
            }`}
          >
            <div
              className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                autoHide ? 'left-5' : 'left-0.5'
              }`}
            />
          </button>
        </label>
      </div>

      {/* Shortcut info */}
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-2">快捷键</h3>
        <div className="py-3 px-4 rounded-xl bg-gray-50">
          <div className="flex items-center gap-2">
            <kbd className="px-2 py-0.5 rounded-md bg-white border border-gray-200 text-xs font-mono text-gray-600 shadow-sm">
              Ctrl
            </kbd>
            <span className="text-gray-400">+</span>
            <kbd className="px-2 py-0.5 rounded-md bg-white border border-gray-200 text-xs font-mono text-gray-600 shadow-sm">
              Shift
            </kbd>
            <span className="text-gray-400">+</span>
            <kbd className="px-2 py-0.5 rounded-md bg-white border border-gray-200 text-xs font-mono text-gray-600 shadow-sm">
              V
            </kbd>
            <span className="ml-2 text-xs text-gray-500">唤起剪贴板窗口</span>
          </div>
        </div>
      </div>

      {/* Export / Import */}
      <ExportImport />

      {/* About */}
      <div className="pt-2 text-center">
        <p className="text-[10px] text-gray-300">剪贴板管理器 v1.0.0</p>
      </div>
    </div>
  )
}
