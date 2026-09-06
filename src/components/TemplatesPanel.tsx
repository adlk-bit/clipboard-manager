import { useEffect, useState } from 'react'
import { defaultTemplateValues, renderTemplate, templateVariables, type TextTemplate } from '../../shared/productivity'
import { useStore } from '../stores/useStore'
import { maskSensitivePreview } from '../lib/sensitive-content'
import { Modal, useWords, errorText, fieldClass, buttonClass, primaryClass } from './ProductivityShared'

export function TemplateEditor({ template, body = '', onClose, onSaved }: { template?: TextTemplate; body?: string; onClose: () => void; onSaved: () => void }) {
  const q = useWords()
  const english = useStore((s) => s.language === 'en')
  const [title, setTitle] = useState(template?.title || '')
  const [text, setText] = useState(template?.body || body)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  return <Modal title={q('编辑短语模板', 'Edit phrase template')} onClose={onClose}>
    <label className="block text-xs">{q('标题', 'Title')}<input aria-label={q('模板标题', 'Template title')} maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} className={fieldClass} /></label>
    <label className="block text-xs">{q('正文', 'Body')}<textarea aria-label={q('模板正文', 'Template body')} rows={7} maxLength={10000} value={text} onChange={(e) => setText(e.target.value)} className={fieldClass} /></label>
    <p className="text-[11px] text-gray-500 dark:text-gray-400">{q('用 {{姓名}} 添加变量。{{日期}}、{{时间}} 自动填入当前值，复制前可以修改。保存为独立短语，不改动原历史。', 'Use {{name}} for variables. {{date}} and {{time}} get current defaults; edit them before copying. Saving creates an independent phrase.')}</p>
    {error && <p role="alert" className="text-xs text-red-500">{error}</p>}
    <button className={primaryClass} disabled={busy} onClick={async () => {
      setBusy(true); setError('')
      try { await window.api.saveTemplate(template?.id || null, title, text); onSaved(); onClose() }
      catch (error) { setError(errorText(error, english)) } finally { setBusy(false) }
    }}>{q('保存模板', 'Save template')}</button>
  </Modal>
}
function TemplateUse({ template, onClose, onCopied }: { template: TextTemplate; onClose: () => void; onCopied: (text: string) => void }) {
  const q = useWords(), english = useStore((s) => s.language === 'en')
  const [values, setValues] = useState(() => defaultTemplateValues(template.body))
  const [error, setError] = useState(''), [busy, setBusy] = useState(false)
  let preview = '', validation = ''
  try { preview = renderTemplate(template.body, values) } catch (error) { validation = errorText(error, english) }
  return <Modal title={template.title} onClose={onClose}>
    {templateVariables(template.body).map((key) => <label key={key} className="block text-xs">{key}<input className={fieldClass} value={values[key]} maxLength={10000} onChange={(e) => setValues({ ...values, [key]: e.target.value })} /></label>)}
    <p className="text-xs font-medium">{q('复制预览', 'Copy preview')}</p>
    <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap break-words rounded bg-gray-100 p-2 text-xs dark:bg-white/5">{preview || validation}</pre>
    {error && <p role="alert" className="text-xs text-red-500">{error}</p>}
    <button className={primaryClass} disabled={busy || !!validation} onClick={async () => {
      setBusy(true)
      try { await window.api.copyTemplate(template.id, values); onCopied(q('已复制', 'Copied')); onClose() }
      catch (error) { setError(errorText(error, english)) } finally { setBusy(false) }
    }}>{q('复制短语', 'Copy phrase')}</button>
  </Modal>
}
export default function TemplatesPanel({ onCopied }: { onCopied: (message: string) => void }) {
  const q = useWords(), english = useStore((s) => s.language === 'en'), masked = useStore((s) => s.sensitivePreview)
  const [items, setItems] = useState<TextTemplate[]>([]), [search, setSearch] = useState('')
  const [editing, setEditing] = useState<TextTemplate | 'new' | null>(null), [using, setUsing] = useState<TextTemplate | null>(null)
  const [deleting, setDeleting] = useState<number | null>(null), [error, setError] = useState('')
  const refresh = () => { void window.api.getTemplates().then(setItems).catch((error) => setError(errorText(error, english))) }
  useEffect(refresh, [])
  return <div className="space-y-3 p-3">
    <div className="flex gap-2"><input className={fieldClass} aria-label={q('搜索短语', 'Search phrases')} placeholder={q('搜索短语', 'Search phrases')} value={search} onChange={(e) => setSearch(e.target.value)} /><button className={primaryClass + ' shrink-0'} onClick={() => setEditing('new')}>{q('新建', 'New')}</button></div>
    <p className="text-[11px] text-gray-500 dark:text-gray-400">{q('保存常用回复，填写变量后复制。也可从历史记录保存为模板。', 'Save common replies and fill variables before copying. You can also save a history item as a template.')}</p>
    {error && <p role="alert" className="text-xs text-red-500">{error}</p>}
    {items.filter((item) => (item.title + '\n' + item.body).toLowerCase().includes(search.toLowerCase())).map((item) => <div key={item.id} className="space-y-2 rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-[#28282b]">
      <h3 className="truncate text-xs font-medium dark:text-gray-100">{masked ? maskSensitivePreview(item.title).text : item.title}</h3>
      <p className="line-clamp-2 break-words text-[11px] text-gray-500 dark:text-gray-400">{masked ? maskSensitivePreview(item.body).text : item.body}</p>
      <div className="flex flex-wrap gap-2"><button className={primaryClass} onClick={() => setUsing(item)}>{q('使用', 'Use')}</button><button className={buttonClass} onClick={() => setEditing(item)}>{q('编辑', 'Edit')}</button><button className={buttonClass} onClick={() => setDeleting(item.id)}>{q('删除', 'Delete')}</button></div>
    </div>)}
    {items.length === 0 && <p className="py-8 text-center text-xs text-gray-500">{q('还没有短语，点击“新建”开始。', 'No phrases yet. Select New to get started.')}</p>}
    {editing && <TemplateEditor template={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} onSaved={refresh} />}
    {using && <TemplateUse template={using} onClose={() => setUsing(null)} onCopied={onCopied} />}
    {deleting !== null && <Modal title={q('删除此模板？', 'Delete this template?')} onClose={() => setDeleting(null)}><button className={buttonClass} onClick={async () => { try { await window.api.deleteTemplate(deleting); setDeleting(null); refresh() } catch (error) { setError(errorText(error, english)) } }}>{q('确认删除', 'Confirm delete')}</button></Modal>}
  </div>
}
