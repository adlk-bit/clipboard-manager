import { useEffect, useRef, useState } from 'react'
import type { HistoryItem } from '../types'
import Icon from './Icon'
import { useI18n } from '../lib/i18n'
import { MAX_COPY_TEXT_LENGTH, mergeText, TEXT_TRANSFORMS, transformText, type TextSeparator, type TextTransform } from '../../shared/text-tools'

interface EditCopyDialogProps {
  items: HistoryItem[]
  onClose: () => void
  onCopied: (message: string, type?: 'success' | 'info') => void
}

export default function EditCopyDialog({ items, onClose, onCopied }: EditCopyDialogProps) {
  const { t } = useI18n()
  const merged = items.length > 1
  const originalText = mergeText(items.map((item) => item.content || ''), 'newline')
  const [content, setContent] = useState(originalText)
  const [separator, setSeparator] = useState<TextSeparator>('newline')
  const [reverse, setReverse] = useState(false)
  const [transform, setTransform] = useState<TextTransform>('trimLines')
  const [undo, setUndo] = useState<string[]>([])
  const [error, setError] = useState('')
  const [copying, setCopying] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const busyRef = useRef(false)
  const unchanged = !merged && content === items[0].content
  const tooLong = content.length > MAX_COPY_TEXT_LENGTH && !unchanged

  const changeContent = (next: string) => {
    if (next !== content) setUndo((previous) => [...previous.slice(-19), content])
    setContent(next)
    setError('')
  }

  const rebuildMerge = (nextSeparator: TextSeparator, nextReverse: boolean) => {
    setSeparator(nextSeparator)
    setReverse(nextReverse)
    changeContent(mergeText(items.map((item) => item.content || ''), nextSeparator, nextReverse))
  }

  const applyTransform = () => {
    try { changeContent(transformText(content, transform)) }
    catch { setError(t('edit.invalidJson')) }
  }

  useEffect(() => {
    textareaRef.current?.focus()
    textareaRef.current?.select()
  }, [])

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.isComposing) { event.preventDefault(); onClose() }
      if (event.key === 'Tab') {
        const dialog = textareaRef.current?.closest('[role="dialog"]')
        const controls = Array.from(dialog?.querySelectorAll<HTMLElement>('button:not(:disabled), select, textarea, input') || [])
        const first = controls[0]
        const last = controls[controls.length - 1]
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
      }
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [onClose])

  const handleCopy = async () => {
    if (!content || busyRef.current || tooLong) return

    busyRef.current = true
    setCopying(true)
    setError('')
    try {
      const result = unchanged
        ? await window.api.copyToClipboard(items[0].id)
        : await window.api.writeTextToClipboard(content)
      if (!result.success) throw new Error('Copy failed')
      onCopied(t(merged ? 'edit.copiedMerged' : 'edit.copied'))
      onClose()
    } catch {
      setError(t('edit.failed'))
    } finally {
      busyRef.current = false
      setCopying(false)
    }
  }

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/35 dark:bg-black/60" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-copy-title"
        className="no-drag mx-3 max-h-[calc(100%-24px)] w-full max-w-[380px] overflow-y-auto rounded-xl border border-[#dedee3] bg-white p-4 shadow-xl dark:border-white/10 dark:bg-[#2c2c2f]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h3 id="edit-copy-title" className="text-sm font-semibold text-[#2f2f33] dark:text-[#f2f2f5]">{merged ? t('edit.mergeTitle', { count: items.length }) : t('edit.title')}</h3>
            <p className="mt-0.5 text-[11px] leading-4 text-[#85858b] dark:text-[#99999f]">{t('edit.hint')}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('edit.close')}
            className="flex size-6 shrink-0 items-center justify-center rounded text-[#85858b] transition-colors hover:bg-black/[0.06] hover:text-[#333338] dark:text-[#99999f] dark:hover:bg-white/[0.08] dark:hover:text-white"
          >
            <Icon name="x" size={14} />
          </button>
        </div>

        {merged && (
          <div className="mb-2 space-y-1.5 text-[11px] text-gray-600 dark:text-gray-300">
            <div className="flex items-center gap-2">
              <label htmlFor="merge-separator">{t('edit.separator')}</label>
              <select id="merge-separator" value={separator} onChange={(event) => rebuildMerge(event.target.value as TextSeparator, reverse)} className="rounded border border-gray-300 bg-white p-1 dark:border-gray-600 dark:bg-gray-700">
                {(['newline', 'blankLine', 'comma', 'tab'] as const).map((value) => <option key={value} value={value}>{t(`edit.separator.${value}`)}</option>)}
              </select>
              <label className="ml-auto flex items-center gap-1"><input type="checkbox" checked={reverse} onChange={(event) => rebuildMerge(separator, event.target.checked)} />{t('edit.reverse')}</label>
            </div>
            <p className="text-[10px] text-gray-500 dark:text-gray-400">{t('edit.mergeHint')}</p>
          </div>
        )}

        <div className="mb-2 flex items-center gap-1.5">
          <select aria-label={t('edit.tools')} value={transform} onChange={(event) => setTransform(event.target.value as TextTransform)} className="min-w-0 flex-1 rounded border border-gray-300 bg-white p-1.5 text-[11px] text-gray-700 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200">
            {TEXT_TRANSFORMS.map((value) => <option key={value} value={value}>{t(`edit.tool.${value}`)}</option>)}
          </select>
          <button type="button" onClick={applyTransform} disabled={copying} className="rounded bg-primary-50 px-2 py-1.5 text-[11px] text-primary-600 dark:bg-primary-900/30 dark:text-primary-300">{t('edit.apply')}</button>
          <button type="button" disabled={undo.length === 0 || copying} onClick={() => {
            setContent(undo[undo.length - 1]); setUndo((previous) => previous.slice(0, -1)); setError('')
          }} className="rounded px-1.5 py-1.5 text-[11px] text-gray-500 disabled:opacity-40 dark:text-gray-300">{t('edit.undo')}</button>
          <button type="button" disabled={copying} onClick={() => { setSeparator('newline'); setReverse(false); changeContent(originalText) }} className="rounded px-1.5 py-1.5 text-[11px] text-gray-500 dark:text-gray-300">{t('edit.reset')}</button>
        </div>

        <textarea
          ref={textareaRef}
          value={content}
          onChange={(event) => changeContent(event.target.value)}
          onKeyDown={(event) => {
            if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && !event.nativeEvent.isComposing) {
              event.preventDefault()
              void handleCopy()
            }
          }}
          disabled={copying}
          spellCheck={false}
          aria-label={t('edit.content')}
          style={{ height: 'clamp(80px, calc(100vh - 320px), 176px)' }}
          className="w-full resize-none rounded-lg border border-[#d7d7dc] bg-[#fafafa] px-2.5 py-2 text-[13px] leading-5 text-[#303034] outline-none transition-colors focus:border-[#3d91df] focus:bg-white dark:border-white/10 dark:bg-black/20 dark:text-[#eeeeF2] dark:focus:border-[#3d91df] dark:focus:bg-black/10"
        />

        <div className="mt-1 flex min-h-4 items-center justify-between gap-2">
          <p role="status" className="text-[10px] text-red-500 dark:text-red-400">{tooLong ? t('edit.tooLong', { count: MAX_COPY_TEXT_LENGTH }) : error}</p>
          <span className="shrink-0 text-[10px] tabular-nums text-[#99999f] dark:text-[#85858b]">{content.length} / {MAX_COPY_TEXT_LENGTH}</span>
        </div>

        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-8 flex-1 rounded-md bg-gray-100 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={() => void handleCopy()}
            disabled={!content || copying || tooLong}
            className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md bg-[#087bd1] text-xs font-medium text-white transition-colors hover:bg-[#006bbb] disabled:cursor-not-allowed disabled:bg-[#b8c7d3] dark:bg-[#1687da] dark:hover:bg-[#2695e5] dark:disabled:bg-[#46535d]"
          >
            <Icon name="copy" size={13} />
            {copying ? t('edit.copying') : t(merged ? 'edit.copyMerged' : 'edit.copy')}
          </button>
        </div>

        <p className="mt-2 text-center text-[10px] text-[#9a9aa0] dark:text-[#7f7f85]">{t('edit.shortcut')}</p>
      </div>
    </div>
  )
}
