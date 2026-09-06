import { useEffect, useRef, type ReactNode } from 'react'
import { useI18n } from '../lib/i18n'
export const fieldClass = 'w-full rounded-md border border-gray-300 bg-white p-2 text-xs text-gray-800 dark:border-gray-600 dark:bg-[#232326] dark:text-gray-100'
export const buttonClass = 'rounded-md border border-gray-300 px-2 py-1.5 text-xs text-gray-700 hover:bg-gray-100 disabled:opacity-40 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-white/10'
export const primaryClass = 'rounded-md bg-primary-500 px-3 py-1.5 text-xs text-white disabled:opacity-40'
export function useWords() { const { language } = useI18n(); return (zh: string, en: string) => language === 'en' ? en : zh }
export function errorText(error: unknown, english: boolean): string {
  const message = error instanceof Error ? error.message : String(error)
  const errors: [string, string, string][] = [
    ['template-missing-value', '请填写所有变量。', 'Fill in every variable.'],
    ['template-output-limit', '生成文字超过 10,000 字符，请缩短内容。', 'Generated text exceeds 10,000 characters.'],
    ['template-variables-limit', '每个模板最多 32 个变量。', 'Use at most 32 variables per template.'],
    ['invalid-template', '请输入标题和正文（最多 120 / 10,000 字符）。', 'Enter a title and body (up to 120 / 10,000 characters).'],
    ['ocr-language-unavailable', '未安装此识别语言。请在 Windows 设置中添加语言和 OCR 功能后重试。', 'Install this language and its OCR feature in Windows Settings, then retry.'],
    ['ocr-unavailable', 'Windows 文字识别暂不可用。请检查已安装的语言和 OCR 功能。', 'Windows OCR is unavailable. Check installed languages and OCR features.'],
    ['ocr-timeout', '识别超时，请裁剪图片后重试。', 'Recognition timed out. Crop the image and retry.'],
    ['ocr-busy', '另一张图片正在识别，请稍后重试。', 'Another image is being recognized. Try again shortly.'],
    ['ocr-image-limit', '图片超过识别上限（20 MB / 1.2 亿像素），请裁剪后重试。', 'Image exceeds 20 MB / 120 megapixels. Crop it and retry.'],
    ['ocr-output-limit', '识别文字超过 50,000 字符，请裁剪后重试。', 'Recognized text exceeds 50,000 characters. Crop and retry.'],
    ['ocr-cancelled', '图片或识别缓存已清除，本次结果未保存。', 'Image or OCR cache was cleared. Result was discarded.'],
    ['ocr-image-missing', '图片已删除或无法读取。', 'The image was deleted or cannot be read.'],
    ['queue-already-active', '已有粘贴队列，请先结束当前队列。', 'Finish the current queue first.'],
    ['queue-hotkey-conflict', '顺序粘贴快捷键被占用，请释放 Ctrl+Shift+Alt+V 后重试。', 'Ctrl+Shift+Alt+V is in use. Free the shortcut and retry.'],
    ['queue-focus-target', '请先切到目标应用，再按顺序粘贴快捷键。', 'Focus the destination app before pressing the queue shortcut.'],
    ['clipboard-changed', '剪贴板在粘贴前发生变化，队列已暂停，请检查后继续。', 'Clipboard changed before pasting. Check it before resuming.'],
    ['target-changed', '目标窗口已改变，队列已暂停。回到原窗口后继续，或重新选择目标。', 'Destination changed. Return to the original window and resume, or choose a new target.'],
    ['release-shortcut', '请松开快捷键后重试。', 'Release the shortcut keys and retry.'],
    ['input-blocked', '目标应用阻止了粘贴，进度未前移。管理员窗口可能无法接收。', 'Paste was blocked. Progress was kept. Elevated windows may reject input.'],
    ['input-uncertain', '粘贴结果不确定，请检查目标内容后再继续，避免重复。', 'Paste result is uncertain. Check the target before resuming to avoid duplicates.'],
    ['native-timeout', '操作超时。请检查目标内容后再继续，避免重复。', 'Operation timed out. Check the target before resuming to avoid duplicates.'],
    ['native-unavailable', 'Windows 辅助模块不可用，请重新启动应用。', 'Windows helper is unavailable. Restart the app.'],
    ['invalid-exclusions', '请输入应用进程名，例如 chrome.exe；最多 50 项。', 'Enter process names such as chrome.exe; up to 50 entries.'],
  ]
  const match = errors.find(([code]) => message.includes(code))
  return match ? match[english ? 2 : 1] : english ? 'Operation failed. Try again.' : '操作失败，请重试。'
}
export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const q = useWords()
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null
    ref.current?.querySelector<HTMLElement>('input,textarea,button')?.focus()
    return () => { if (before?.isConnected) before.focus() }
  }, [])
  return <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
    <div ref={ref} role="dialog" aria-modal="true" aria-label={title} className="no-drag mx-3 max-h-[calc(100%-24px)] w-full max-w-[420px] space-y-3 overflow-y-auto rounded-xl bg-white p-4 text-gray-800 shadow-xl dark:bg-[#2c2c2f] dark:text-gray-100" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => {
      if (event.key === 'Escape' && !event.nativeEvent.isComposing) { event.preventDefault(); onClose() }
      if (event.key === 'Tab') {
        const controls = Array.from(ref.current?.querySelectorAll<HTMLElement>('input:not(:disabled),textarea:not(:disabled),select:not(:disabled),button:not(:disabled)') || [])
        const first = controls[0], last = controls[controls.length - 1]
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
      }
    }}>
      <div className="flex items-center justify-between gap-2"><h2 className="text-sm font-semibold">{title}</h2><button className={buttonClass} onClick={onClose}>{q('关闭', 'Close')}</button></div>
      {children}
    </div>
  </div>
}
