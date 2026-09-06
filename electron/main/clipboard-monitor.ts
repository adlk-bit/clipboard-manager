import { clipboard } from 'electron'
import path from 'path'
import fs from 'fs'
import { createHash, randomUUID } from 'crypto'
import { MonitorPauseState } from './monitor-state'
import { getSetting, insertHistory } from './database'
import { getHistoryImagesDir } from './asset-paths'
import { windowsNative, type ClipboardState } from './windows-native'
import { parseExcludedApps } from '../../shared/productivity'

let lastTextContent = ''
let lastImageHash = ''
let lastType = ''
let lastSequence = -1
let epoch = 0
let monitorTimer: NodeJS.Timeout | null = null
let eventTimer: NodeJS.Timeout | null = null
let unsubscribe: (() => void) | null = null
let processing = false
let baselinePending = false
const pauseState = new MonitorPauseState()
const stats = { notifications: 0, reads: 0, imageEncodes: 0 }
export function getCaptureStats() { return { ...stats } }
const hashPng = (png: Buffer) => createHash('sha256').update(png).digest('hex')
export function resetCaptureBaseline(): void {
  epoch++
  // Events received while paused/excluded are consumed, never replayed later.
  lastSequence = windowsNative.state?.sequence ?? -1
  if (windowsNative.available) {
    baselinePending = true
    const currentEpoch = epoch
    void windowsNative.request<ClipboardState>('state').then((state) => {
      if (epoch === currentEpoch) lastSequence = state.sequence
    }).catch(() => {}).finally(() => { if (epoch === currentEpoch) baselinePending = false })
  } else {
    baselinePending = false
    if (parseExcludedApps(getSetting('excluded_apps') || '[]').length === 0) primeFingerprint()
  }
}
function primeFingerprint(): void {
  const image = clipboard.readImage()
  if (!image.isEmpty()) { lastImageHash = hashPng(image.toPNG()); lastTextContent = ''; lastType = 'image' }
  else { lastTextContent = clipboard.readText(); lastImageHash = ''; lastType = 'text' }
}
export async function checkClipboard(onHistoryChanged?: () => void): Promise<void> {
  if (processing || baselinePending) return
  processing = true
  const currentEpoch = epoch
  try {
    let state: ClipboardState | null = null
    if (windowsNative.available) {
      state = await windowsNative.request<ClipboardState>('state')
      if (state.sequence === lastSequence) return
      lastSequence = state.sequence
    }
    if (!pauseState.canPoll() || currentEpoch !== epoch) return
    const excluded = parseExcludedApps(getSetting('excluded_apps') || '[]')
    if (excluded.length && (!state?.sourceApp || excluded.includes(state.sourceApp))) return
    stats.reads++
    const image = clipboard.readImage()
    const type = image.isEmpty() ? 'text' : 'image'
    let png: Buffer | null = null
    let text = ''
    let hash = ''
    if (type === 'image') { stats.imageEncodes++; png = image.toPNG(); hash = hashPng(png) }
    else { text = clipboard.readText(); if (text.length > 10000) text = text.slice(0, 10000) + '...' }
    // Reject snapshots changed while being read, before writing either file or DB.
    if (state && (await windowsNative.request<ClipboardState>('state')).sequence !== state.sequence) return
    if (currentEpoch !== epoch || !pauseState.canPoll()) return
    if (type === 'image' && png) {
      if (lastType === 'image' && hash === lastImageHash) return
      lastType = type; lastImageHash = hash; lastTextContent = ''
      if (png.length > parseInt(getSetting('max_image_size_mb') || '10', 10) * 1024 * 1024) return
      const filepath = path.join(getHistoryImagesDir(), `clip_${randomUUID()}.png`)
      fs.writeFileSync(filepath, png)
      const result = insertHistory('image', null, filepath, hash, state?.sourceApp || '')
      if (!result.created) fs.unlinkSync(filepath)
      if (result.id) onHistoryChanged?.()
    } else {
      if (!text.trim() || (lastType === 'text' && text === lastTextContent)) return
      lastType = type; lastTextContent = text; lastImageHash = ''
      if (insertHistory('text', text, null, '', state?.sourceApp || '').id) onHistoryChanged?.()
    }
  } catch { console.warn('Clipboard capture unavailable; will retry on the next change.') }
  finally { processing = false }
}
export function startMonitor(intervalMs = 500, onHistoryChanged?: () => void): void {
  stopMonitor(); resetCaptureBaseline()
  unsubscribe = windowsNative.subscribe(() => {
    stats.notifications++
    if (eventTimer) clearTimeout(eventTimer)
    eventTimer = setTimeout(() => { eventTimer = null; void checkClipboard(onHistoryChanged) }, 25)
  })
  // Also provides recovery after a lost notification or helper exit. Unchanged
  // sequences return before readImage/toPNG; listeners trigger immediate work.
  monitorTimer = setInterval(() => { void checkClipboard(onHistoryChanged) }, windowsNative.listening ? 2000 : intervalMs)
}
export function stopMonitor(): void {
  epoch++; unsubscribe?.(); unsubscribe = null
  if (monitorTimer) clearInterval(monitorTimer)
  if (eventTimer) clearTimeout(eventTimer)
  monitorTimer = null; eventTimer = null
}
export function isMonitorPaused(): boolean { return pauseState.isPaused() }
export function setMonitorPaused(paused: boolean): void {
  if (pauseState.setPaused(paused)) resetCaptureBaseline()
}
export function markClipboardHistoryItemCopied(item: { type: 'text' | 'image'; content: string | null; image?: Electron.NativeImage }): void {
  lastType = item.type
  if (item.type === 'text' && item.content) { lastTextContent = item.content; lastImageHash = '' }
  else if (item.image) { lastImageHash = hashPng(item.image.toPNG()); lastTextContent = '' }
}
