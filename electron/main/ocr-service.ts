import { spawn } from 'child_process'
import path from 'path'
import fs from 'fs'
import { nativeResource } from './windows-native'
import { getHistoryById, updateOcr, clearOcr } from './database'
import { getHistoryImagesDir, isPathInside } from './asset-paths'
import type { OcrResult, OcrStatus } from '../../shared/productivity'

let generation = 0
let active = false
function runOcr<T>(request: object): Promise<T> {
  return new Promise((resolve, reject) => {
    if (process.platform !== 'win32') { reject(new Error('ocr-unavailable')); return }
    const child = spawn(path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'), ['-NoProfile', '-NonInteractive', '-File', nativeResource('ocr.ps1')], { windowsHide: true })
    let output = ''; let settled = false
    const finish = (error?: string, result?: T) => {
      if (settled) return; settled = true; clearTimeout(timer)
      if (error) reject(new Error(error)); else resolve(result!)
    }
    const timer = setTimeout(() => { child.kill(); finish('ocr-timeout') }, 30000)
    child.on('error', () => finish('ocr-unavailable'))
    child.stdout.setEncoding('utf8').on('data', (chunk) => {
      output += chunk
      if (output.length > 1000000) { child.kill(); finish('ocr-output-limit') }
    })
    child.stderr.resume()
    child.stdin.on('error', () => finish('ocr-unavailable'))
    child.stdin.end(JSON.stringify(request))
    child.on('close', (code) => {
      try {
        const result = JSON.parse(output.replace(/^\uFEFF/, '').trim())
        finish(code === 0 && !result.error ? undefined : (/^ocr-[a-z-]+$/.test(result.error) ? result.error : 'ocr-unavailable'), result)
      } catch { finish('ocr-unavailable') }
    })
  })
}
export function getOcrStatus(): Promise<OcrStatus> { return runOcr({ action: 'status' }) }
export function clearOcrCache(id: number | null): void { generation++; clearOcr(id) }
export async function recognizeHistory(id: number, language: string, force = false): Promise<OcrResult> {
  if (active) throw new Error('ocr-busy')
  const item = getHistoryById(id)
  if (!item || item.type !== 'image' || !item.image_path || !isPathInside(getHistoryImagesDir(), item.image_path)) throw new Error('ocr-image-missing')
  if (!fs.existsSync(item.image_path)) throw new Error('ocr-image-missing')
  if (fs.statSync(item.image_path).size > 20 * 1024 * 1024) throw new Error('ocr-image-limit')
  if (!force && item.ocr_language && (language === 'auto' || language === item.ocr_language)) return { text: item.ocr_text, language: item.ocr_language, cached: true }
  active = true
  const currentGeneration = generation
  try {
    const result = await runOcr<{ text: string; language: string }>({ action: 'recognize', imagePath: item.image_path, language })
    if (typeof result.text !== 'string' || result.text.length > 50000) throw new Error('ocr-output-limit')
    if (currentGeneration !== generation || getHistoryById(id)?.image_path !== item.image_path) throw new Error('ocr-cancelled')
    updateOcr(id, result.text, result.language)
    return { ...result, cached: false }
  } finally { active = false }
}
