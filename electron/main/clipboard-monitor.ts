import { clipboard, nativeImage, app } from 'electron'
import path from 'path'
import fs from 'fs'
import { createHash } from 'crypto'
import { getSetting, insertHistory } from './database'

let lastTextContent = ''
let lastImageHash = ''
let monitorTimer: NodeJS.Timeout | null = null
let imagesDir: string | null = null

function getImagesDir(): string {
  if (!imagesDir) {
    imagesDir = path.join(app.getPath('userData'), 'images')
    if (!fs.existsSync(imagesDir)) {
      fs.mkdirSync(imagesDir, { recursive: true })
    }
  }
  return imagesDir
}

function hashPng(png: Buffer): string {
  return createHash('sha256').update(png).digest('hex')
}

function saveImageFile(png: Buffer): string {
  const timestamp = Date.now()
  const filename = `clip_${timestamp}.png`
  const filepath = path.join(getImagesDir(), filename)
  fs.writeFileSync(filepath, png)
  return filepath
}

export function checkClipboard(onHistoryChanged?: () => void) {
  // Check for image first (clipboard may contain both text and image)
  const image = clipboard.readImage()
  if (!image.isEmpty()) {
    // Encoding a large clipboard image is expensive and temporarily allocates
    // a large buffer. Reuse the PNG bytes for hashing and file persistence
    // instead of encoding the same NativeImage twice.
    const png = image.toPNG()
    const imgHash = hashPng(png)
    if (imgHash !== lastImageHash) {
      lastImageHash = imgHash
      try {
        const maxBytes = parseInt(getSetting('max_image_size_mb') || '10', 10) * 1024 * 1024
        if (png.length > maxBytes) {
          console.warn(`Clipboard image skipped: ${png.length} bytes exceeds configured limit`)
          return
        }
        const filepath = saveImageFile(png)
        const result = insertHistory('image', null, filepath, imgHash)
        if (!result.created) {
          try { fs.unlinkSync(filepath) } catch (error) { console.error('Failed to remove duplicate clipboard image:', error) }
        }
        if (result.id) onHistoryChanged?.()
      } catch (e) {
        console.error('Failed to save clipboard image:', e)
      }
    }
    return
  }

  // Check for text
  const text = clipboard.readText()
  if (text && text.trim().length > 0) {
    // Limit text length to prevent huge entries
    const trimmed = text.length > 10000 ? text.slice(0, 10000) + '...' : text

    if (trimmed !== lastTextContent) {
      lastTextContent = trimmed
      if (insertHistory('text', trimmed, null).id) onHistoryChanged?.()
    }
  }
}

export function startMonitor(intervalMs: number = 500, onHistoryChanged?: () => void) {
  // Reset state on start
  lastTextContent = ''
  lastImageHash = ''
  monitorTimer = setInterval(() => checkClipboard(onHistoryChanged), intervalMs)
}

export function stopMonitor() {
  if (monitorTimer) {
    clearInterval(monitorTimer)
    monitorTimer = null
  }
}

export function markClipboardHistoryItemCopied(item: { type: 'text' | 'image'; content: string | null; image?: Electron.NativeImage }) {
  if (item.type === 'text' && item.content) {
    lastTextContent = item.content
  } else if (item.type === 'image' && item.image) {
    lastImageHash = hashPng(item.image.toPNG())
  }
}
