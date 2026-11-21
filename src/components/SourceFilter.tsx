import { useCallback, useEffect, useRef, useState } from 'react'
import { useStore } from '../stores/useStore'
import { useWords } from './ProductivityShared'

export default function SourceFilter() {
  const q = useWords()
  const source = useStore((s) => s.sourceApp)
  const setSource = useStore((s) => s.setSourceApp)
  const [apps, setApps] = useState<string[]>([])
  const revision = useRef(0)

  const refresh = useCallback(async () => {
    const request = ++revision.current
    try {
      const options = await window.api.getSourceApps()
      if (request === revision.current) setApps(options)
    } catch { /* Keep the current options when refresh fails. */ }
  }, [])

  useEffect(() => {
    void refresh()
    return () => { revision.current++ }
  }, [refresh])

  const options = source && source !== '__unknown__' && !apps.includes(source) ? [...apps, source] : apps
  return (
    <label className="source-filter" htmlFor="source-filter">
      <span>{q('来源', 'Source')}</span>
      <select id="source-filter" value={source} onFocus={refresh} onChange={(event) => setSource(event.target.value)}>
        <option value="">{q('所有应用', 'All apps')}</option>
        <option value="__unknown__">{q('未知来源', 'Unknown source')}</option>
        {options.map((app) => <option key={app} value={app}>{app}</option>)}
      </select>
    </label>
  )
}
