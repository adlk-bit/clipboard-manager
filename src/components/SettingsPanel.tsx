import { useEffect, useState } from 'react'
import { useStore } from '../stores/useStore'
import ExportImport from './ExportImport'
import { buildHotkey } from '../lib/hotkey'
import { useI18n, type AppLanguage } from '../lib/i18n'

export default function SettingsPanel() {
  const { language, t } = useI18n()
  const retentionDays = useStore((s) => s.retentionDays)
  const darkMode = useStore((s) => s.darkMode)
  const hotkey = useStore((s) => s.hotkey)
  const maxHistoryItems = useStore((s) => s.maxHistoryItems)
  const maxImageSizeMb = useStore((s) => s.maxImageSizeMb)
  const historyStats = useStore((s) => s.historyStats)
  const setRetentionDays = useStore((s) => s.setRetentionDays)
  const setDarkMode = useStore((s) => s.setDarkMode)
  const setLanguage = useStore((s) => s.setLanguage)
  const setHotkey = useStore((s) => s.setHotkey)
  const setMaxHistoryItems = useStore((s) => s.setMaxHistoryItems)
  const setMaxImageSizeMb = useStore((s) => s.setMaxImageSizeMb)
  const saveSettings = useStore((s) => s.saveSettings)
  const loadSettings = useStore((s) => s.loadSettings)
  const loadHistoryStats = useStore((s) => s.loadHistoryStats)
  const [isRecordingHotkey, setIsRecordingHotkey] = useState(false)
  const [hotkeyMessage, setHotkeyMessage] = useState(() => t('settings.hotkeyDefault'))
  const [appVersion, setAppVersion] = useState('')

  useEffect(() => {
    loadSettings()
    window.api.getAppVersion().then(setAppVersion).catch(() => setAppVersion(''))
  }, [])

  useEffect(() => {
    setHotkeyMessage(t('settings.hotkeyDefault'))
  }, [language, t])

  const handleRetentionChange = (days: string) => {
    setRetentionDays(days)
    saveSettings('retention_days', days)
  }

  const handleDarkModeChange = (on: boolean) => {
    setDarkMode(on)
    saveSettings('dark_mode', on ? 'true' : 'false')
  }

  const handleLanguageChange = (nextLanguage: AppLanguage) => {
    setLanguage(nextLanguage)
    saveSettings('language', nextLanguage)
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
      setHotkeyMessage(t('settings.hotkeyCancelled'))
      return
    }

    const nextHotkey = buildHotkey(event)
    if (!nextHotkey) {
      setHotkeyMessage(t('settings.hotkeyNeedModifier'))
      return
    }

    const result = await window.api.setHotkey(nextHotkey)
    if (result.success && result.hotkey) {
      setHotkey(result.hotkey)
      setHotkeyMessage(t('settings.hotkeyEnabled', { hotkey: result.hotkey }))
      setIsRecordingHotkey(false)
    } else {
      setHotkeyMessage(result.error || t('settings.hotkeyFailed'))
    }
  }

  return (
    <div className="space-y-3 p-3">
      <div>
        <div className="mb-1.5 flex items-baseline justify-between gap-2">
          <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-200">{t('settings.storage')}</h3>
          <span className="truncate text-[10px] text-gray-400 dark:text-gray-500">{t('settings.storageHint')}</span>
        </div>
        <div className="grid grid-cols-4 gap-1.5 rounded-lg border border-[#e2e2e6] bg-white p-1.5 dark:border-white/[0.08] dark:bg-[#28282b]">
          {[
            { value: '1', label: language === 'en' ? '1 day' : t('settings.day', { count: 1 }) },
            { value: '3', label: language === 'en' ? '3 days' : t('settings.day', { count: 3 }) },
            { value: '5', label: language === 'en' ? '5 days' : t('settings.day', { count: 5 }) },
            { value: '0', label: t('settings.forever') },
          ].map((opt) => (
            <button key={opt.value} onClick={() => handleRetentionChange(opt.value)} className={`no-drag h-7 rounded-md text-[11px] font-medium transition-colors ${retentionDays === opt.value ? 'bg-[#0078d4] text-white' : 'text-[#55555a] hover:bg-[#edf6ff] hover:text-[#006bd6] dark:text-[#d1d1d6] dark:hover:bg-white/[0.07] dark:hover:text-[#53a9ff]'}`}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-1.5 text-xs font-semibold text-gray-700 dark:text-gray-200">{t('settings.appearance')}</h3>
        <div className="space-y-1.5">
          <SettingToggle title={t('settings.darkMode')} description={t('settings.darkModeHint')} enabled={darkMode} onChange={handleDarkModeChange} />
          <LanguageSetting language={language} onChange={handleLanguageChange} t={t} />
        </div>
      </div>

      <div>
        <h3 className="mb-1.5 text-xs font-semibold text-gray-700 dark:text-gray-200">{t('settings.hotkey')}</h3>
        <div className="rounded-lg border border-[#e2e2e6] bg-white p-2.5 dark:border-white/[0.08] dark:bg-[#28282b]">
          <button
            type="button"
            onClick={() => { setIsRecordingHotkey(true); setHotkeyMessage(t('settings.hotkeyRecording')) }}
            onBlur={() => setIsRecordingHotkey(false)}
            onKeyDown={handleHotkeyKeyDown}
            aria-pressed={isRecordingHotkey}
            className={`no-drag h-8 w-full cursor-pointer rounded-md border bg-[#fafafa] px-2.5 text-left font-mono text-xs text-gray-700 outline-none transition-colors dark:bg-gray-700 dark:text-gray-200 ${isRecordingHotkey ? 'border-primary-400 ring-1 ring-primary-200 dark:border-primary-500 dark:ring-primary-900/50' : 'border-gray-200 dark:border-gray-600'}`}
            aria-label={t('settings.hotkeyAria')}
          >
            {isRecordingHotkey ? t('settings.hotkeyPress') : hotkey}
          </button>
          <p className="mt-1.5 text-[10px] leading-4 text-gray-500 dark:text-gray-400">{hotkeyMessage}</p>
        </div>
      </div>

      <div>
        <h3 className="mb-1.5 text-xs font-semibold text-gray-700 dark:text-gray-200">{t('settings.capacity')}</h3>
        <div className="rounded-lg border border-[#e2e2e6] bg-white p-2.5 dark:border-white/[0.08] dark:bg-[#28282b]">
          <p className="mb-2 text-[11px] text-gray-500 dark:text-gray-400">{t('settings.capacityCurrent', { count: historyStats.itemCount, size: formatBytes(historyStats.imageBytes) })}</p>
          <p className="mb-1 text-[10px] text-gray-400 dark:text-gray-500">{t('settings.maxItems')}</p>
          <div className="grid grid-cols-4 gap-1.5">
            {['100', '300', '500', '1000'].map((value) => (
              <button key={value} onClick={() => handleMaxHistoryItemsChange(value)} className={`no-drag h-7 rounded-md text-[11px] ${maxHistoryItems === value ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'}`}>{value}</button>
            ))}
          </div>
          <p className="mb-1 mt-2 text-[10px] text-gray-400 dark:text-gray-500">{t('settings.maxImage')}</p>
          <div className="grid grid-cols-4 gap-1.5">
            {['1', '5', '10', '20'].map((value) => (
              <button key={value} onClick={() => handleMaxImageSizeChange(value)} className={`no-drag h-7 rounded-md text-[11px] ${maxImageSizeMb === value ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'}`}>{value} MB</button>
            ))}
          </div>
        </div>
      </div>

      <ExportImport />

      <div className="pt-0.5 text-center">
        <p className="text-[10px] text-gray-300 dark:text-gray-600">{t('app.name')}{appVersion ? ` v${appVersion}` : ''}</p>
      </div>
    </div>
  )
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function SettingToggle({ title, description, enabled, onChange }: { title: string; description: string; enabled: boolean; onChange: (value: boolean) => void }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-[#e2e2e6] bg-white px-2.5 py-2 dark:border-white/[0.08] dark:bg-[#28282b]">
      <div>
        <p className="text-xs text-gray-700 dark:text-gray-200">{title}</p>
        <p className="mt-0.5 text-[10px] text-gray-400 dark:text-gray-500">{description}</p>
      </div>
      <button type="button" role="switch" aria-checked={enabled} onClick={() => onChange(!enabled)} className={`no-drag relative h-5 w-9 shrink-0 rounded-full transition-colors duration-150 ${enabled ? 'bg-[#34a853]' : 'bg-[#c7c7cc] dark:bg-[#636366]'}`}>
        <span className={`absolute left-0.5 top-0.5 size-4 rounded-full bg-white shadow-sm transition-transform duration-150 ${enabled ? 'translate-x-4' : 'translate-x-0'}`} />
      </button>
    </div>
  )
}

function LanguageSetting({ language, onChange, t }: { language: AppLanguage; onChange: (language: AppLanguage) => void; t: ReturnType<typeof useI18n>['t'] }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-[#e2e2e6] bg-white px-2.5 py-2 dark:border-white/[0.08] dark:bg-[#28282b]">
      <div className="min-w-0">
        <p className="text-xs text-gray-700 dark:text-gray-200">{t('settings.language')}</p>
        <p className="mt-0.5 truncate text-[10px] text-gray-400 dark:text-gray-500">{t('settings.languageHint')}</p>
      </div>
      <div className="no-drag flex shrink-0 rounded-md bg-[#ededf0] p-0.5 dark:bg-white/[0.08]" role="group" aria-label={t('settings.language')}>
        {([
          { value: 'zh-CN' as const, label: t('settings.chinese') },
          { value: 'en' as const, label: t('settings.english') },
        ]).map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={language === option.value}
            onClick={() => onChange(option.value)}
            className={`h-6 rounded px-2 text-[10px] font-medium transition-colors ${language === option.value ? 'bg-white text-[#006bd6] shadow-sm dark:bg-white/10 dark:text-[#53a9ff]' : 'text-[#66666c] hover:text-[#29292d] dark:text-[#aaaab0] dark:hover:text-white'}`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}
