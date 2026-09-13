import { clipboard, globalShortcut, BrowserWindow } from 'electron'
import { getHistoryById, recordHistoryUse } from './database'
import { markClipboardHistoryItemCopied } from './clipboard-monitor'
import { windowsNative, type Foreground, type ClipboardState } from './windows-native'
import { QUEUE_HOTKEY, type QueueStatus } from '../../shared/productivity'
import { acquirePaste, releasePaste } from './paste-operation'

class PasteQueue {
  private items: { id: number; text: string }[] = []
  private target: Foreground | null = null
  private cursor = 0
  private paused = true
  private busy = false
  private error = ''
  status(): QueueStatus { return { total: this.items.length, cursor: this.cursor, paused: this.paused, busy: this.busy, target: this.target?.sourceApp || '', error: this.error } }
  private changed(): void { BrowserWindow.getAllWindows().forEach((window) => window.webContents.send('queue:changed', this.status())) }
  start(ids: number[]): QueueStatus {
    if (this.busy) throw new Error('queue-busy')
    if (this.items.length) throw new Error('queue-already-active')
    if (!windowsNative.available) throw new Error('native-unavailable')
    if (!ids.length || ids.length > 100 || ids.some((id) => !Number.isInteger(id) || id < 1)) throw new Error('queue-invalid-items')
    const items = ids.map((id) => getHistoryById(id))
    if (items.some((item) => !item || item.type !== 'text' || !item.content)) throw new Error('queue-text-only')
    if (!globalShortcut.register(QUEUE_HOTKEY, () => { void this.paste() })) throw new Error('queue-hotkey-conflict')
    this.items = items.map((item) => ({ id: item!.id, text: item!.content! }))
    this.cursor = 0; this.paused = false; this.error = ''; this.target = null; this.changed()
    return this.status()
  }
  control(action: string): QueueStatus {
    if (this.busy) throw new Error('queue-busy')
    this.error = ''
    if (action === 'stop') {
      globalShortcut.unregister(QUEUE_HOTKEY); this.items = []; this.cursor = 0; this.target = null; this.paused = true
    } else if (action === 'pause') this.paused = true
    else if (action === 'resume') this.paused = false
    else if (action === 'skip') this.cursor = Math.min(this.items.length, this.cursor + 1)
    else if (action === 'back') this.cursor = Math.max(0, this.cursor - 1)
    else if (action === 'retarget') { this.target = null; this.paused = false }
    else throw new Error('queue-invalid-action')
    this.changed(); return this.status()
  }
  async paste(): Promise<void> {
    if (this.busy || this.paused || this.cursor >= this.items.length) return
    if (!acquirePaste()) return
    this.busy = true; this.error = ''; this.changed()
    try {
      const current = await windowsNative.request<Foreground>('foreground')
      if (!current.pid || current.pid === process.pid) throw new Error('queue-focus-target')
      if (this.target && (current.pid !== this.target.pid || current.handle !== this.target.handle)) throw new Error('target-changed')
      this.target = current
      const item = this.items[this.cursor]
      clipboard.writeText(item.text)
      if (clipboard.readText() !== item.text) throw new Error('queue-write-failed')
      markClipboardHistoryItemCopied({ type: 'text', content: item.text })
      const snapshot = await windowsNative.request<ClipboardState>('state')
      if (clipboard.readText() !== item.text) throw new Error('clipboard-changed')
      await windowsNative.request('paste', { handle: current.handle, pid: current.pid, sequence: snapshot.sequence })
      recordHistoryUse(item.id); this.cursor++
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'queue-failed'
      this.paused = true
    } finally { releasePaste(); this.busy = false; this.changed() }
  }
}
export const pasteQueue = new PasteQueue()
