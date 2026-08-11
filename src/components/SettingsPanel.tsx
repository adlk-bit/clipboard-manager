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
    <div className="p-5 space-y-5">
      <div>
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">存储期限</h3>
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">超过期限的记录将自动清理（置顶和收藏记录不受影响）</p>
        <div className="grid grid-cols-4 gap-2">
          {[
            { value: '1', label: '1 天' },
            { value: '3', label: '3 天' },
            { value: '5', label: '5 天' },
            { value: '0', label: '永久' },
          ].map((opt) => (
            <button key={opt.value} onClick={() => handleRetentionChange(opt.value)} className={`no-drag py-2 px-3 rounded-[10px] text-xs font-medium transition-[background-color,color,transform,box-shadow] duration-150 active:scale-[0.97] ${retentionDays === opt.value ? 'bg-[#007aff] text-white shadow-[0_3px_8px_rgba(0,122,255,0.22)]' : 'bg-white/[0.85] dark:bg-[#2c2c2e] text-[#48484a] dark:text-[#d1d1d6] shadow-[0_1px_2px_rgba(60,60,67,0.08)] hover:bg-[#eaf4ff] dark:hover:bg-white/10 hover:text-[#007aff]'}`}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <SettingToggle sectionTitle="外观" title="深色模式" description="切换为深色界面主题" enabled={darkMode} onChange={handleDarkModeChange} />

      <div>
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">快捷键</h3>
        <div className="py-3 px-4 rounded-[14px] bg-white/80 dark:bg-[#2c2c2e] border border-white/80 dark:border-white/10 shadow-[0_1px_2px_rgba(60,60,67,0.08)]">
          <button
            type="button"
            onClick={() => { setIsRecordingHotkey(true); setHotkeyMessage('正在录入，请按下新的组合键。') }}
            onBlur={() => setIsRecordingHotkey(false)}
            onKeyDown={handleHotkeyKeyDown}
            aria-pressed={isRecordingHotkey}
            className={`no-drag w-full cursor-pointer rounded-lg border bg-white px-3 py-2 text-left text-sm font-mono text-gray-700 outline-none transition-colors focus:ring-2 focus:ring-primary-100 dark:bg-gray-700 dark:text-gray-200 dark:focus:ring-primary-900/40 ${isRecordingHotkey ? 'border-primary-400 ring-2 ring-primary-100 dark:border-primary-500 dark:ring-primary-900/40' : 'border-gray-200 dark:border-gray-600'}`}
            aria-label="全局快捷键"
          >
            {isRecordingHotkey ? '请按下组合键…' : hotkey}
          </button>
          <p className="mt-2 text-[10px] text-gray-500 dark:text-gray-400">{hotkeyMessage}</p>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">历史容量</h3>
        <div className="rounded-[14px] bg-white/80 p-3 dark:bg-[#2c2c2e] border border-white/80 dark:border-white/10 shadow-[0_1px_2px_rgba(60,60,67,0.08)]">
          <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">当前 {historyStats.itemCount} 条记录，图片占用 {formatBytes(historyStats.imageBytes)}。达到条目上限时，最旧的非置顶、非收藏记录会自动清理。</p>
          <p className="mb-1.5 text-[10px] text-gray-400 dark:text-gray-500">最大条目数</p>
          <div className="grid grid-cols-4 gap-1.5">
            {['100', '300', '500', '1000'].map((value) => (
              <button key={value} onClick={() => handleMaxHistoryItemsChange(value)} className={`no-drag rounded-md py-1.5 text-xs ${maxHistoryItems === value ? 'bg-primary-500 text-white' : 'bg-white text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}>{value}</button>
            ))}
          </div>
          <p className="mb-1.5 mt-3 text-[10px] text-gray-400 dark:text-gray-500">单张图片最大大小</p>
          <div className="grid grid-cols-4 gap-1.5">
            {['1', '5', '10', '20'].map((value) => (
              <button key={value} onClick={() => handleMaxImageSizeChange(value)} className={`no-drag rounded-md py-1.5 text-xs ${maxImageSizeMb === value ? 'bg-primary-500 text-white' : 'bg-white text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}>{value} MB</button>
            ))}
          </div>
        </div>
      </div>

      <ExportImport />

      <div className="pt-2 text-center">
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
      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">{sectionTitle}</h3>
      <label className="flex items-center justify-between py-3 px-4 rounded-[14px] bg-white/80 dark:bg-[#2c2c2e] border border-white/80 dark:border-white/10 shadow-[0_1px_2px_rgba(60,60,67,0.08)] cursor-pointer hover:bg-white dark:hover:bg-white/10 transition-colors">
        <div>
          <p className="text-sm text-gray-700 dark:text-gray-200">{title}</p>
          <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">{description}</p>
        </div>
        <button onClick={() => onChange(!enabled)} className={`no-drag relative w-11 h-6 rounded-full transition-colors duration-200 ${enabled ? 'bg-[#34c759]' : 'bg-[#c7c7cc] dark:bg-[#636366]'}`}>
          <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.2)] transition-transform duration-200 ${enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
        </button>
      </label>
    </div>
  )
}
