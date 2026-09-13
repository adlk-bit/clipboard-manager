import { app, type BrowserWindow } from 'electron'
import { spawn, type ChildProcessWithoutNullStreams } from 'child_process'
import { createInterface } from 'readline'
import path from 'path'

export interface ClipboardState { sequence: number; sourceApp: string; ownerPid: number }
export interface Foreground { handle: string; pid: number; sourceApp: string }
export function nativeResource(name: string): string {
  return path.join(app.isPackaged ? process.resourcesPath : app.getAppPath(), 'native', app.isPackaged || name.endsWith('.ps1') ? '' : 'bin', name)
}
class WindowsNative {
  private child: ChildProcessWithoutNullStreams | null = null
  private pending = new Map<number, { resolve: (value: any) => void; reject: (error: Error) => void; timer: NodeJS.Timeout }>()
  private listeners = new Set<(state: ClipboardState) => void>()
  private serial = 0
  available = false
  listening = false
  state: ClipboardState | null = null
  async start(): Promise<void> {
    if (process.platform !== 'win32' || this.child) return
    await new Promise<void>((ready) => {
      const child = spawn(nativeResource('ClipboardBridge.exe'), [String(process.pid)], { windowsHide: true, stdio: 'pipe' })
      this.child = child
      const timer = setTimeout(() => { this.stop(); ready() }, 5000)
      const finish = () => { clearTimeout(timer); ready() }
      child.on('error', () => { this.stop(); finish() })
      child.on('exit', () => { this.stop(); finish() })
      child.stderr.resume()
      createInterface({ input: child.stdout }).on('line', (line) => {
        try {
          const message = JSON.parse(line)
          if (message.type === 'ready') {
            this.available = true; this.listening = message.listener === true; this.state = message.state; finish()
          } else if (message.type === 'clipboard') {
            this.state = message.state
            this.listeners.forEach((listener) => listener(message.state))
          } else {
            const request = this.pending.get(message.id)
            if (!request) return
            clearTimeout(request.timer); this.pending.delete(message.id)
            if (message.error) request.reject(new Error(message.error))
            else request.resolve(message.result)
          }
        } catch { /* ignore malformed protocol lines, never log clipboard metadata */ }
      })
    })
  }
  request<T>(command: string, args: Record<string, unknown> = {}): Promise<T> {
    if (!this.available || !this.child) return Promise.reject(new Error('native-unavailable'))
    return new Promise((resolve, reject) => {
      const id = ++this.serial
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error('native-timeout')) }, 5000)
      this.pending.set(id, { resolve, reject, timer })
      this.child!.stdin.write(JSON.stringify({ id, action: command, ...args }) + '\n', (error) => {
        if (error) { clearTimeout(timer); this.pending.delete(id); reject(new Error('native-unavailable')) }
      })
    })
  }
  subscribe(listener: (state: ClipboardState) => void): () => void { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  stop(): void {
    const child = this.child; this.child = null; this.available = false; this.listening = false
    this.pending.forEach((request) => { clearTimeout(request.timer); request.reject(new Error('native-unavailable')) })
    this.pending.clear(); child?.kill()
  }
}
export const windowsNative = new WindowsNative()
/** A child started while the panel is foreground may restore the chosen target
 * under Windows' normal foreground rules. No input-thread attachment or keys
 * used to bypass the system's focus restrictions. */
export function restoreAndPaste(args: Record<string, unknown>): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(nativeResource('ClipboardBridge.exe'), [String(process.pid), '--quick-paste'], { windowsHide: true, stdio: 'pipe' })
    let settled = false
    const finish = (error?: Error) => {
      if (settled) return
      settled = true; clearTimeout(timer); child.kill()
      if (error) reject(error); else resolve()
    }
    const timer = setTimeout(() => finish(new Error('input-uncertain')), 5000)
    child.on('error', () => finish(new Error('native-unavailable')))
    child.on('exit', () => finish(new Error('input-uncertain')))
    child.stderr.resume()
    createInterface({ input: child.stdout }).on('line', (line) => {
      try {
        const value = JSON.parse(line)
        finish(value.result === true ? undefined : new Error(value.error || 'input-uncertain'))
      } catch { finish(new Error('input-uncertain')) }
    })
    child.stdin.on('error', () => finish(new Error('native-unavailable')))
    child.stdin.end(JSON.stringify({ action: 'restoreAndPaste', ...args }) + '\n')
  })
}
export function windowHandle(window: BrowserWindow): string {
  const handle = window.getNativeWindowHandle()
  return handle.length === 8 ? handle.readBigUInt64LE().toString() : handle.readUInt32LE().toString()
}
