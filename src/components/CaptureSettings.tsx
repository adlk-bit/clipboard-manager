import { useEffect, useState } from 'react'
import { useStore } from '../stores/useStore'
import { Modal, useWords, errorText, fieldClass, buttonClass } from './ProductivityShared'
export default function CaptureSettings() {
  const q = useWords(), english = useStore((s) => s.language === 'en')
  const [apps, setApps] = useState<string[]>([]), [name, setName] = useState(''), [known, setKnown] = useState<string[]>([])
  const [error, setError] = useState(''), [native, setNative] = useState<boolean | null>(null), [busy, setBusy] = useState(false)
  const [clear, setClear] = useState(false), [message, setMessage] = useState('')
  useEffect(() => { let live = true; const refresh = () => { void Promise.all([window.api.getExcludedApps(), window.api.getSourceApps(), window.api.getCaptureStatus()]).then(([apps, known, status]) => { if (live) { setApps(apps); setKnown(known); setNative(status.native) } }).catch((error) => { if (live) setError(errorText(error, english)) }); }; refresh(); const unsubscribe = window.api.onHistoryChanged(refresh); return () => { live = false; unsubscribe() } }, [])
  const save = async (next: string[]) => { setBusy(true); setError(''); try { setApps(await window.api.setExcludedApps(next)); setName('') } catch (error) { setError(errorText(error, english)) } finally { setBusy(false) } }
  return <section className="space-y-2 rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-[#28282b]">
    <h3 className="text-xs font-medium dark:text-gray-100">{q('来源与采集排除', 'Sources & capture exclusions')}</h3>
    <p className="text-[11px] text-gray-500 dark:text-gray-400">{q('填写进程名，例如 chrome.exe。只记录应用名称，不记录窗口标题或路径。来源无法确定时，存在排除规则就暂停采集该内容；旧记录显示为未知来源。', 'Use process names such as chrome.exe. Only app names are retained. With exclusions enabled, unknown sources are skipped. Older records have an unknown source.')}</p>
    {native === false && <p className="text-[11px] text-amber-600">{q('辅助模块不可用：当前使用兼容采集，来源未知。', 'Helper unavailable: compatibility capture has unknown sources.')}</p>}
    <div className="flex gap-2"><input className={fieldClass} aria-label={q('排除应用', 'Excluded app')} list="source-app-names" placeholder="chrome.exe" maxLength={120} value={name} onChange={(e) => setName(e.target.value)} /><button className={buttonClass + ' shrink-0'} disabled={busy || !name.trim()} onClick={() => save([...apps, name])}>{q('添加', 'Add')}</button></div>
    <datalist id="source-app-names">{known.map((name) => <option key={name} value={name} />)}</datalist>
    <ul className="space-y-1">{apps.map((app) => <li key={app} className="flex items-center justify-between gap-2 text-xs dark:text-gray-200"><span className="truncate">{app}</span><button className={buttonClass} disabled={busy} aria-label={q('移除 ', 'Remove ') + app} onClick={() => save(apps.filter((value) => value !== app))}>{q('移除', 'Remove')}</button></li>)}</ul>
    {error && <p role="alert" className="text-xs text-red-500">{error}</p>}
    <div className="border-t border-gray-200 pt-2 dark:border-gray-700"><h3 className="mb-1 text-xs font-medium dark:text-gray-100">{q('图片文字索引', 'Image text index')}</h3><p className="mb-2 text-[11px] text-gray-500 dark:text-gray-400">{q('在图片卡片上点击 OCR 识别后，即可搜索图片中的文字。索引保存在本机，并随备份导出。', 'Choose OCR on an image card to make its text searchable. The local index is included in backups.')}</p><button className={buttonClass} onClick={() => setClear(true)}>{q('清除所有 OCR 索引', 'Clear all OCR indexes')}</button></div>
    {message && <p role="status" className="text-xs text-primary-500">{message}</p>}
    {clear && <Modal title={q('清除所有 OCR 索引？', 'Clear all OCR indexes?')} onClose={() => setClear(false)}><p className="text-xs">{q('图片会保留，可随时重新识别。', 'Images are kept and can be recognized again.')}</p><button className={buttonClass} onClick={async () => { try { await window.api.clearOcr(null); setClear(false); setMessage(q('索引已清除', 'Indexes cleared')) } catch (error) { setError(errorText(error, english)) } }}>{q('确认清除', 'Confirm clear')}</button></Modal>}
  </section>
}
