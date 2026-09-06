import { useEffect, useRef, useState } from 'react'
import type { QueueStatus } from '../../shared/productivity'
import { useStore } from '../stores/useStore'
import { useWords, errorText, buttonClass } from './ProductivityShared'
export default function QueueBar() {
  const q = useWords(), english = useStore((s) => s.language === 'en')
  const [status, setStatus] = useState<QueueStatus | null>(null), [error, setError] = useState('')
  const revision = useRef(0)
  useEffect(() => {
    const current = revision.current
    void window.api.getQueueStatus().then((value) => { if (revision.current === current) setStatus(value) })
    return window.api.onQueueChanged((value) => { revision.current++; setStatus(value); setError('') })
  }, [])
  if (!status?.total) return null
  const control = async (action: string) => { try { await window.api.controlQueue(action) } catch (error) { setError(errorText(error, english)) } }
  return <section aria-label={q('顺序粘贴队列', 'Paste queue')} className="no-drag max-h-48 shrink-0 space-y-1.5 overflow-y-auto border-b border-primary-200 bg-primary-50 p-2 text-xs dark:border-primary-900 dark:bg-primary-900/20 dark:text-gray-100">
    <p className="font-medium">{q('顺序粘贴', 'Paste queue')} · {status.cursor}/{status.total} {status.cursor === status.total ? q('已完成', 'Complete') : status.paused ? q('已暂停', 'Paused') : ''}</p>
    <p className="text-[10px]">{q('切到目标应用，按 Ctrl+Shift+Alt+V 粘贴下一条。', 'Focus the destination and press Ctrl+Shift+Alt+V for the next item.')}</p>
    {status.target && <p className="truncate text-[10px]">{q('目标：', 'Target: ')}{status.target}</p>}
    <div className="flex flex-wrap gap-1">
      <button className={buttonClass} disabled={status.busy || status.cursor === status.total} onClick={() => control(status.paused ? 'resume' : 'pause')}>{status.paused ? q('继续', 'Resume') : q('暂停', 'Pause')}</button>
      <button className={buttonClass} disabled={status.busy || status.cursor === 0} title={q('回退队列进度，不撤销已粘贴内容', 'Rewinds the queue; does not undo pasted text')} onClick={() => control('back')}>{q('退一条', 'Back')}</button>
      <button className={buttonClass} disabled={status.busy || status.cursor === status.total} onClick={() => control('skip')}>{q('跳过', 'Skip')}</button>
      <button className={buttonClass} disabled={status.busy} onClick={() => control('retarget')}>{q('重新选目标', 'New target')}</button>
      <button className={buttonClass} disabled={status.busy} onClick={() => control('stop')}>{q('结束', 'Finish')}</button>
    </div>
    {(status.error || error) && <p role="alert" className="text-[11px] text-red-600 dark:text-red-400">{error || errorText(status.error, english)}</p>}
  </section>
}
