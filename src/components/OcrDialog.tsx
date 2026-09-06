import { useEffect, useRef, useState } from 'react'
import type { HistoryItem } from '../types'
import type { OcrStatus } from '../../shared/productivity'
import { useStore } from '../stores/useStore'
import { Modal, useWords, errorText, fieldClass, buttonClass, primaryClass } from './ProductivityShared'
export default function OcrDialog({ item, onClose, onCopied }: { item: HistoryItem; onClose: () => void; onCopied: (message: string) => void }) {
  const q = useWords(), english = useStore((s) => s.language === 'en')
  const [status, setStatus] = useState<OcrStatus | null>(null), [language, setLanguage] = useState('auto')
  const [text, setText] = useState(item.ocr_text || ''), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const [cached, setCached] = useState(!!item.ocr_language)
  const generation = useRef(0)
  useEffect(() => { let live = true; window.api.getOcrStatus().then((status) => { if (live) setStatus(status) }).catch((error) => { if (live) setError(errorText(error, english)) }); return () => { live = false; generation.current++ } }, [])
  const recognize = async () => {
    const current = ++generation.current; setBusy(true); setError('')
    try { const result = await window.api.recognizeImage(item.id, language, true); if (generation.current === current) { setText(result.text); setCached(true) } }
    catch (error) { if (generation.current === current) setError(errorText(error, english)) }
    finally { if (generation.current === current) setBusy(false) }
  }
  return <Modal title={q('图片文字识别', 'Recognize image text')} onClose={onClose}>
    <p className="text-[11px] text-gray-500 dark:text-gray-400">{q('使用 Windows 本地 OCR，不上传图片。识别后可搜索截图中的文字；清除索引不会删除图片。编辑框中的修改只用于本次复制。', 'Uses local Windows OCR. Images stay on this device. Recognized text becomes searchable; clearing the index keeps the image. Edits below affect only this copy.')}</p>
    <select className={fieldClass} aria-label={q('识别语言', 'OCR language')} value={language} onChange={(e) => setLanguage(e.target.value)} disabled={busy}><option value="auto">{q('自动选择', 'Automatic')}</option>{status?.languages.map((lang) => <option key={lang.tag} value={lang.tag}>{lang.name}</option>)}</select>
    <button className={primaryClass} disabled={busy || !status?.available} onClick={recognize}>{busy ? q('正在识别…', 'Recognizing…') : cached ? q('重新识别', 'Recognize again') : q('开始识别', 'Recognize')}</button>
    {status && !status.available && <p className="text-xs text-amber-600">{q('请在 Windows 设置中安装所需语言的 OCR 功能。', 'Install the required language OCR feature in Windows Settings.')}</p>}
    {error && <p role="alert" className="text-xs text-red-500">{error}</p>}
    <textarea className={fieldClass} rows={8} aria-label={q('识别结果', 'Recognized text')} value={text} onChange={(e) => setText(e.target.value)} />
    {cached && !text && <p className="text-xs text-gray-500">{q('未找到文字，请尝试更清晰的图片或其他语言。', 'No text found. Try a clearer image or another language.')}</p>}
    {text.length > 10000 && <p className="text-xs text-amber-600">{q('复制上限为 10,000 字符，请在框中缩短文字。', 'Copy limit is 10,000 characters. Shorten the text above.')}</p>}
    <div className="flex flex-wrap gap-2"><button className={primaryClass} disabled={busy || !text || text.length > 10000} onClick={async () => {
      try { if (!(await window.api.writeTextToClipboard(text)).success) throw new Error(); onCopied(q('已复制识别文字', 'Recognized text copied')); onClose() } catch (error) { setError(errorText(error, english)) }
    }}>{q('复制文字', 'Copy text')}</button><button className={buttonClass} disabled={!cached || busy} onClick={async () => { try { await window.api.clearOcr(item.id); setText(''); setCached(false); setError('') } catch (error) { setError(errorText(error, english)) } }}>{q('清除索引', 'Clear index')}</button></div>
  </Modal>
}
