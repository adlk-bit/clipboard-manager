import { useEffect, useRef, useState } from 'react'
import type { HistoryItem } from '../types'
import Icon from './Icon'
import { useI18n } from '../lib/i18n'

interface EditCopyDialogProps {
  item: HistoryItem
  onClose: () => void
  onCopied: (message: string, type?: 'success' | 'info') => void
}

export default function EditCopyDialog({ item, onClose, onCopied }: EditCopyDialogProps) {
  const { t } = useI18n()
  const [content, setContent] = useState(item.content || '')
  const [error, setError] = useState('')
  const [copying, setCopying] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    textareaRef.current?.focus()
    textareaRef.current?.select()
  }, [])

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [onClose])

  const handleCopy = async () => {
    if (!content || copying) return

    setCopying(true)
    setError('')
    const result = content === item.content
      ? await window.api.copyToClipboard(item.id)
      : await window.api.writeTextToClipboard(content)

    if (!result.success) {
      setError(t('edit.failed'))
      setCopying(false)
      return
    }

    onCopied(content === item.content ? t('edit.copied') : t('edit.copiedChanged'))
    onClose()
  }

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/35 dark:bg-black/60" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-copy-title"
        className="no-drag mx-4 w-full max-w-[330px] rounded-xl border border-[#dedee3] bg-white p-4 shadow-xl dark:border-white/10 dark:bg-[#2c2c2f]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h3 id="edit-copy-title" className="text-sm font-semibold text-[#2f2f33] dark:text-[#f2f2f5]">{t('edit.title')}</h3>
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

        <textarea
          ref={textareaRef}
          value={content}
          onChange={(event) => {
            setContent(event.target.value)
            if (error) setError('')
          }}
          onKeyDown={(event) => {
            if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
              event.preventDefault()
              void handleCopy()
            }
          }}
          maxLength={10000}
          spellCheck={false}
          aria-label={t('edit.content')}
          className="h-44 w-full resize-none rounded-lg border border-[#d7d7dc] bg-[#fafafa] px-2.5 py-2 text-[13px] leading-5 text-[#303034] outline-none transition-colors focus:border-[#3d91df] focus:bg-white dark:border-white/10 dark:bg-black/20 dark:text-[#eeeeF2] dark:focus:border-[#3d91df] dark:focus:bg-black/10"
        />

        <div className="mt-1 flex min-h-4 items-center justify-between gap-2">
          <p className="text-[10px] text-red-500 dark:text-red-400">{error}</p>
          <span className="shrink-0 text-[10px] tabular-nums text-[#99999f] dark:text-[#85858b]">{content.length} / 10000</span>
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
            disabled={!content || copying}
            className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md bg-[#087bd1] text-xs font-medium text-white transition-colors hover:bg-[#006bbb] disabled:cursor-not-allowed disabled:bg-[#b8c7d3] dark:bg-[#1687da] dark:hover:bg-[#2695e5] dark:disabled:bg-[#46535d]"
          >
            <Icon name="copy" size={13} />
            {copying ? t('edit.copying') : t('edit.copy')}
          </button>
        </div>

        <p className="mt-2 text-center text-[10px] text-[#9a9aa0] dark:text-[#7f7f85]">{t('edit.shortcut')}</p>
      </div>
    </div>
  )
}
