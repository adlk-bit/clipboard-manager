import type { BrowserWindow } from 'electron'
import { windowsNative, windowHandle } from './windows-native'
import { setSetting } from './database'

const updates = new WeakMap<BrowserWindow, Promise<boolean>>()
export async function getAlwaysOnTop(window: BrowserWindow): Promise<boolean> {
  if (windowsNative.available) return windowsNative.request<boolean>('topmost', { handle: windowHandle(window) })
  return window.isAlwaysOnTop()
}
export function applyAlwaysOnTop(window: BrowserWindow, enabled: boolean, persist = true): Promise<boolean> {
  const previous = updates.get(window) || Promise.resolve(false)
  const update = previous.catch(() => false).then(async () => {
    if (window.isDestroyed()) throw new Error('Window closed')
    window.setAlwaysOnTop(enabled)
    const actual = windowsNative.available
      ? await windowsNative.request<boolean>('setTopmost', { handle: windowHandle(window), enabled })
      : window.isAlwaysOnTop()
    if (actual !== enabled) throw new Error('Could not apply always-on-top')
    if (persist) setSetting('window_always_on_top', String(enabled))
    window.webContents.send('window:topmost-changed', actual)
    return actual
  })
  updates.set(window, update)
  return update
}
