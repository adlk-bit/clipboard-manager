import { BrowserWindow, clipboard, ipcMain, Notification } from 'electron'
import { getHistoryById, getSetting, recordHistoryUse } from './database'
import { markClipboardHistoryItemCopied } from './clipboard-monitor'
import { windowsNative, windowHandle, restoreAndPaste, type Foreground, type ClipboardState } from './windows-native'
import { QuickPasteSession, type QuickPasteResult } from '../../shared/quick-paste'
import { acquirePaste, releasePaste } from './paste-operation'

const session = new QuickPasteSession<Foreground>()
let opening = false
const status = () => session.status((target) => target.sourceApp)
function changed(window: BrowserWindow): void {
  if (!window.isDestroyed()) window.webContents.send('quick-paste:changed', status())
}
export function cancelQuickPaste(window: BrowserWindow | null): void {
  session.cancel()
  if (window) changed(window)
}
export function quickPasteBusy(): boolean { return session.busy }

export async function openQuickPaste(window: BrowserWindow, show: () => void): Promise<void> {
  if (opening || session.busy) return
  opening = true
  try {
    const previousRevision = status().session
    const target = await windowsNative.request<Foreground>('foreground').catch(() => null)
    if (status().session !== previousRevision || window.isDestroyed()) return
    // Native foreground is authoritative; Electron focus events can lag behind
    // a hotkey arriving from another process.
    if (target?.pid === process.pid) { show(); return }
    const token = session.begin()
    if (token === null) return
    if (target && target.pid && target.pid !== process.pid) session.bind(token, target)
    if (status().session !== token || !status().active || window.isDestroyed()) return
    show()
    changed(window)
  } finally { opening = false }
}

export function registerQuickPaste(window: BrowserWindow): void {
  window.on('blur', () => {
    if (opening || session.busy) return
    const token = status().session
    void windowsNative.request<Foreground>('foreground').then((foreground) => {
      if (!session.busy && !opening && status().session === token && foreground.handle !== windowHandle(window)) cancelQuickPaste(window)
    }).catch(() => { if (!session.busy && !opening && status().session === token) cancelQuickPaste(window) })
  })
  window.on('hide', () => { if (!session.busy) cancelQuickPaste(window) })
  window.on('minimize', () => { if (!session.busy) cancelQuickPaste(window) })
  ipcMain.handle('quick-paste:status', () => status())
  ipcMain.handle('quick-paste:cancel', () => cancelQuickPaste(window))
  ipcMain.handle('quick-paste:paste', async (event, id: unknown, token: unknown): Promise<QuickPasteResult> => {
    if (event.sender !== window.webContents || !window.isFocused() || !Number.isSafeInteger(id) || Number(id) < 1 || !Number.isSafeInteger(token)) return { success: false, copied: false, error: 'invalid-request' }
    const item = getHistoryById(Number(id))
    if (!item || item.type !== 'text' || !item.content) return { success: false, copied: false, error: 'text-only' }
    if (!acquirePaste()) return { success: false, copied: false, error: 'paste-busy' }
    const claimed = session.claim(Number(token))
    if (!claimed) { releasePaste(); return { success: false, copied: false, error: 'session-expired' } }
    changed(window)
    let copied = false
    let stage = 'copy'
    try {
      clipboard.writeText(item.content)
      if (clipboard.readText() !== item.content) throw new Error('copy-failed')
      copied = true
      markClipboardHistoryItemCopied({ type: 'text', content: item.content })
      recordHistoryUse(item.id)
      window.webContents.send('history:changed')
      if (!claimed.target) throw new Error('native-unavailable')
      const snapshot = await windowsNative.request<ClipboardState>('state')
      if (clipboard.readText() !== item.content) throw new Error('clipboard-changed')
      stage = 'restore-and-paste'
      if (!window.isFocused() || status().session !== token) throw new Error('target-changed')
      await restoreAndPaste({
        handle: claimed.target.handle, pid: claimed.target.pid,
        fromHandle: windowHandle(window), sequence: snapshot.sequence,
      })
      window.hide()
      return { success: true, copied: true }
    } catch (error) {
      const code = error instanceof Error ? error.message : 'paste-failed'
      console.warn('Quick paste could not complete:', stage, code)
      // Do not claim the clipboard still contains our text after another copy.
      copied = copied && clipboard.readText() === item.content
      if (!window.isFocused() && Notification.isSupported()) {
        const en = getSetting('language') === 'en'
        new Notification({ title: en ? 'Quick paste needs attention' : '快捷粘贴未完成', body: copied
          ? (en ? 'Text copied. Check the destination before pasting manually.' : '文字已复制，请检查目标内容后手动粘贴。')
          : (en ? 'Clipboard changed. Reopen history to copy again.' : '剪贴板已变化，请重新打开历史复制。') }).show()
      }
      return { success: false, copied, error: code }
    } finally { session.finish(); releasePaste(); changed(window) }
  })
}
