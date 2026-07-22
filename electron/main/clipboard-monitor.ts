import { clipboard, nativeImage, app } from 'electron'
import path from 'path'
import fs from 'fs'
import { insertHistory } from './database'

let lastTextContent = ''
let lastImageHash = ''
let monitorTimer: NodeJS.Timeout | null = null
let imagesDir: string | null = null
let lastInsertedId: number | null = null

function getImagesDir(): string {
  if (!imagesDir) {
    imagesDir = path.join(app.getPath('userData'), 'images')
    if (!fs.existsSync(imagesDir)) {
      fs.mkdirSync(imagesDir, { recursive: true })
    }
  }
  return imagesDir
}

function hashImage(image: Electron.NativeImage): string {
  const png = image.toPNG()
  const len = png.length
  const first = png.slice(0, 16).toString('hex')
  const last = png.slice(-16).toString('hex')
  return `${len}-${first}-${last}`
}

function saveImageFile(image: Electron.NativeImage): string {
  const timestamp = Date.now()
  const filename = `clip_${timestamp}.png`
  const filepath = path.join(getImagesDir(), filename)
  fs.writeFileSync(filepath, image.toPNG())
  return filepath
}

export function checkClipboard() {
  // Check for image first (clipboard may contain both text and image)
  const image = clipboard.readImage()
  if (!image.isEmpty()) {
    const imgHash = hashImage(image)
    if (imgHash !== lastImageHash) {
      lastImageHash = imgHash
      try {
        const filepath = saveImageFile(image)
        insertHistory('image', null, filepath)
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
      insertHistory('text', trimmed, null)
    }
  }
}

export function startMonitor(intervalMs: number = 500) {
  // Reset state on start
  lastTextContent = ''
  lastImageHash = ''
  monitorTimer = setInterval(checkClipboard, intervalMs)
}

export function stopMonitor() {
  if (monitorTimer) {
    clearInterval(monitorTimer)
    monitorTimer = null
  }
}
