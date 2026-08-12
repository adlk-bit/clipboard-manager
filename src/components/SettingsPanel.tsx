import { useEffect, useState } from 'react'
import { useStore } from '../stores/useStore'
import ExportImport from './ExportImport'
import { buildHotkey } from '../lib/hotkey'

export default function SettingsPanel() {
  const retentionDays = useStore((s) => s.retentionDays)
  const darkMode = useStore((s) => s.darkMode)
  const hotkey = useStore((s) => s.hotkey)
  const maxHistoryItems = useStore((s) => s.maxHistoryItems)
  const maxImageSizeMb = useStore((s) => s.maxImageSizeMb)
  const historyStats = useStore((s) => s.historyStats)
  const setRetentionDays = useStore((s) => s.setRetentionDays)
  const setDarkMode = useStore((s) => s.setDarkMode)
  const setHotkey = useStore((s) => s.setHotkey)
  const setMaxHistoryItems = useStore((s) => s.setMaxHistoryItems)
  const setMaxImageSizeMb = useStore((s) => s.setMaxImageSizeMb)
  const saveSettings = useStore((s) => s.saveSettings)
  const loadSettings = useStore((s) => s.loadSettings)
  const loadHistoryStats = useStore((s) => s.loadHistoryStats)
  const [isRecordingHotkey, setIsRecordingHotkey] = useState(false)
  const [hotkeyMessage, setHotkeyMessage] = useState('点击快捷键按钮后按下新的组合键，即时生效。')
  const [appVersion, setAppVersion] = useState('')

  useEffect(() => {
    loadSettings()
    window.api.getAppVersion().then(setAppVersion).catch(() => setAppVersion(''))
  }, [])

  const handleRetentionChange = (days: string) => {
    setRetentionDays(days)
    saveSettings('retention_days', days)
  }

  const handleDarkModeChange = (on: boolean) => {
    setDarkMode(on)
    saveSettings('dark_mode', on ? 'true' : 'false')
  }

  const handleMaxHistoryItemsChange = async (value: string) => {
    setMaxHistoryItems(value)
    await saveSettings('max_history_items', value)
    await loadHistoryStats()
  }

  const handleMaxImageSizeChange = async (value: string) => {
    setMaxImageSizeMb(value)
    await saveSettings('max_image_size_mb', value)
  }

  const handleHotkeyKeyDown = async (event: React.KeyboardEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()

    if (event.key === 'Escape') {
      setIsRecordingHotkey(false)
      setHotkeyMessage('已取消修改。')
      return
    }

    const nextHotkey = buildHotkey(event)
    if (!nextHotkey) {
      setHotkeyMessage('请至少按住 Ctrl、Alt、Shift 或 Win 之一，再按一个键。')
      return
    }

    const result = await window.api.setHotkey(nextHotkey)
    if (result.success && result.hotkey) {
      setHotkey(result.hotkey)
      setHotkeyMessage(`已启用 ${result.hotkey}。`)
      setIsRecordingHotkey(false)
    } else {
      setHotkeyMessage(result.error || '无法注册该快捷键。')
    }
  }

  return (
    <div className="space-y-3 p-3">
      <div>
        <div className="mb-1.5 flex items-baseline justify-between gap-2">
          <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-200">存储期限</h3>
          <span className="truncate text-[10px] text-gray-400 dark:text-gray-500">置顶和收藏不会清理</span>
        </div>
        <div className="grid grid-cols-4 gap-1.5 rounded-lg border border-[#e2e2e6] bg-white p-1.5 dark:border-white/[0.08] dark:bg-[#28282b]">
          {[
            { value: '1', label: '1 天' },
            { value: '3', label: '3 天' },
            { value: '5', label: '5 天' },
            { value: '0', label: '永久' },
          ].map((opt) => (
            <button key={opt.value} onClick={() => handleRetentionChange(opt.value)} className={`no-drag h-7 rounded-md text-[11px] font-medium transition-colors ${retentionDays === opt.value ? 'bg-[#0078d4] text-white' : 'text-[#55555a] hover:bg-[#edf6ff] hover:text-[#006bd6] dark:text-[#d1d1d6] dark:hover:bg-white/[0.07] dark:hover:text-[#53a9ff]'}`}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <SettingToggle sectionTitle="外观" title="深色模式" description="切换为深色界面主题" enabled={darkMode} onChange={handleDarkModeChange} />

      <div>
        <h3 className="mb-1.5 text-xs font-semibold text-gray-700 dark:text-gray-200">快捷键</h3>
        <div className="rounded-lg border border-[#e2e2e6] bg-white p-2.5 dark:border-white/[0.08] dark:bg-[#28282b]">
          <button
            type="button"
            onClick={() => { setIsRecordingHotkey(true); setHotkeyMessage('正在录入，请按下新的组合键。') }}
            onBlur={() => setIsRecordingHotkey(false)}
            onKeyDown={handleHotkeyKeyDown}
            aria-pressed={isRecordingHotkey}
            className={`no-drag h-8 w-full cursor-pointer rounded-md border bg-[#fafafa] px-2.5 text-left font-mono text-xs text-gray-700 outline-none transition-colors dark:bg-gray-700 dark:text-gray-200 ${isRecordingHotkey ? 'border-primary-400 ring-1 ring-primary-200 dark:border-primary-500 dark:ring-primary-900/50' : 'border-gray-200 dark:border-gray-600'}`}
            aria-label="全局快捷键"
          >
            {isRecordingHotkey ? '请按下组合键…' : hotkey}
          </button>
          <p className="mt-1.5 text-[10px] leading-4 text-gray-500 dark:text-gray-400">{hotkeyMessage}</p>
        </div>
      </div>

      <div>
        <h3 className="mb-1.5 text-xs font-semibold text-gray-700 dark:text-gray-200">历史容量</h3>
        <div className="rounded-lg border border-[#e2e2e6] bg-white p-2.5 dark:border-white/[0.08] dark:bg-[#28282b]">
          <p className="mb-2 text-[11px] text-gray-500 dark:text-gray-400">当前 {historyStats.itemCount} 条，图片 {formatBytes(historyStats.imageBytes)}</p>
          <p className="mb-1 text-[10px] text-gray-400 dark:text-gray-500">最大条目数</p>
          <div className="grid grid-cols-4 gap-1.5">
            {['100', '300', '500', '1000'].map((value) => (
              <button key={value} onClick={() => handleMaxHistoryItemsChange(value)} className={`no-drag h-7 rounded-md text-[11px] ${maxHistoryItems === value ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'}`}>{value}</button>
            ))}
          </div>
          <p className="mb-1 mt-2 text-[10px] text-gray-400 dark:text-gray-500">单张图片上限</p>
          <div className="grid grid-cols-4 gap-1.5">
            {['1', '5', '10', '20'].map((value) => (
              <button key={value} onClick={() => handleMaxImageSizeChange(value)} className={`no-drag h-7 rounded-md text-[11px] ${maxImageSizeMb === value ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'}`}>{value} MB</button>
            ))}
          </div>
        </div>
      </div>

      <ExportImport />

      <div className="pt-0.5 text-center">
        <p className="text-[10px] text-gray-300 dark:text-gray-600">剪贴板管理器{appVersion ? ` v${appVersion}` : ''}</p>
      </div>
    </div>
  )
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function SettingToggle({ sectionTitle, title, description, enabled, onChange }: { sectionTitle: string; title: string; description: string; enabled: boolean; onChange: (value: boolean) => void }) {
  return (
    <div>
      <h3 className="mb-1.5 text-xs font-semibold text-gray-700 dark:text-gray-200">{sectionTitle}</h3>
      <div className="flex items-center justify-between rounded-lg border border-[#e2e2e6] bg-white px-2.5 py-2 dark:border-white/[0.08] dark:bg-[#28282b]">
        <div>
          <p className="text-xs text-gray-700 dark:text-gray-200">{title}</p>
          <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">{description}</p>
        </div>
        <button type="button" role="switch" aria-checked={enabled} onClick={() => onChange(!enabled)} className={`no-drag relative h-5 w-9 rounded-full transition-colors duration-150 ${enabled ? 'bg-[#34a853]' : 'bg-[#c7c7cc] dark:bg-[#636366]'}`}>
          <span className={`absolute top-0.5 size-4 rounded-full bg-white shadow-sm transition-transform duration-150 ${enabled ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
        </button>
      </div>
    </div>
  )
}
