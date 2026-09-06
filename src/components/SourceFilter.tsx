import { useEffect, useState } from 'react'
import { useStore } from '../stores/useStore'
import { useWords } from './ProductivityShared'
export default function SourceFilter() {
  const q = useWords(), source = useStore((s) => s.sourceApp), setSource = useStore((s) => s.setSourceApp)
  const items = useStore((s) => s.historyItems)
  const [apps, setApps] = useState<string[]>([])
  useEffect(() => { let live = true; window.api.getSourceApps().then((apps) => { if (live) setApps(apps) }).catch(() => {}); return () => { live = false } }, [items])
  return <div className="no-drag flex shrink-0 items-center gap-2 border-b border-gray-200 px-3 py-1 dark:border-white/10"><label className="shrink-0 text-[10px] text-gray-500 dark:text-gray-400" htmlFor="source-filter">{q('来源', 'Source')}</label><select id="source-filter" value={source} onChange={(event) => setSource(event.target.value)} className="min-w-0 flex-1 rounded bg-transparent py-1 text-[11px] text-gray-600 dark:bg-[#1c1c1e] dark:text-gray-300"><option value="">{q('所有应用', 'All apps')}</option><option value="__unknown__">{q('未知来源', 'Unknown source')}</option>{[...new Set([...apps, ...(source && source !== '__unknown__' ? [source] : [])])].map((app) => <option key={app} value={app}>{app}</option>)}</select></div>
}
